import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Timestamp } from "@/lib/prisma-helpers";
import { queryDocs, getDocById, getAllDocs } from "@/lib/prisma-helpers";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCache, invalidateCacheByPrefix } from "@/lib/server-cache";
import { invalidateStatsCache } from "@/lib/stats-cache";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreDebt, FirestoreDebtPayment, FirestoreUtility, FirestoreExpense, FirestoreItem } from "@/types/firestore";
import { isSystemLocked } from "@/lib/lock";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        // Enforce safe limit
        const rawLimit = parseInt(searchParams.get("limit") || "20");
        const limit = Math.min(Math.max(rawLimit, 1), 50); // Hard override to prevent quota abuse
        const type = searchParams.get("type");
        const categoryId = searchParams.get("categoryId");
        const search = searchParams.get("search");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const partyName = searchParams.get("partyName");
        const showDeleted = searchParams.get("deleted") === "true";

        // Build filters
        const filters: Array<{ field: string; operator: '<' | '<=' | '==' | '>' | '>=' | '!=' | 'array-contains' | 'in' | 'array-contains-any'; value: unknown }> = [];

        if (type && (type === "debit" || type === "credit")) {
            filters.push({ field: 'type', operator: '==', value: type });
        }

        if (categoryId) {
            filters.push({ field: 'categoryId', operator: '==', value: categoryId });
        }

        if (from) {
            const fromDate = new Date(from);
            fromDate.setHours(0, 0, 0, 0);
            filters.push({ field: 'date', operator: '>=', value: Timestamp.fromDate(fromDate) });
        }

        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            filters.push({ field: 'date', operator: '<=', value: Timestamp.fromDate(toDate) });
        }

        // Get all entries matching filters, then paginate in-memory after merging virtual entries.
        let entries: (any)[] = [];

        // Logic to support direct Order Number search
        let specificOrderEntries: FirestoreLedger[] = [];
        if (search && /^\d+$/.test(search)) {
            try {
                const orderNum = parseInt(search, 10);
                specificOrderEntries = await queryDocs<FirestoreLedger>('ledger', [{ field: 'orderNumber', operator: '==', value: orderNum }]);
            } catch (e) {
                console.error("Failed to fetch specific order", e);
            }
        }

        // Fetch everything relevant — no limit here; pagination is applied after merging virtual entries
        const queryOpts = { includeDeleted: showDeleted };
        const [rawLedger, rawDebts, rawPayments, rawUtilities] = await Promise.all([
            filters.length > 0
                ? queryDocs<FirestoreLedger>('ledger', filters, { orderBy: 'date', orderDirection: 'desc', ...queryOpts })
                : getAllDocs<FirestoreLedger>('ledger', { orderBy: 'date', orderDirection: 'desc', ...queryOpts }),
            getAllDocs<FirestoreDebt>('debts', { orderBy: 'createdAt', orderDirection: 'desc' }),
            getAllDocs<FirestoreDebtPayment>('debt_payments', { orderBy: 'date', orderDirection: 'desc' }),
            getAllDocs<FirestoreUtility>('utilities', { orderBy: 'dueDate', orderDirection: 'desc' })
        ]);

        // Combine specific order search results with general results
        // Use a Map to deduplicate by ID
        const combinedLedger = new Map();
        [...rawLedger, ...specificOrderEntries].forEach(item => combinedLedger.set(item.id, item));
        let allLedger = Array.from(combinedLedger.values());

        // When viewing trash, only show deleted entries; otherwise filter them out
        if (showDeleted) {
            allLedger = allLedger.filter((e: any) => e.deletedAt != null);
        } else {
            allLedger = allLedger.filter((e: any) => !e.deletedAt);
        }
        entries = allLedger;

        // Filter out physical legacy utility entries to avoid double counting
        // (Since we now inject them as virtual entries from the Utilities collection)
        entries = entries.filter(entry => !entry.note || !entry.note.startsWith("Utility payment:"));

        // Map Debts to virtual entries
        const dateFrom = from ? new Date(from) : null;
        if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
        const dateTo = to ? new Date(to) : null;
        if (dateTo) dateTo.setHours(23, 59, 59, 999);

        const virtualEntries: any[] = [];

        // 1. Process New Loans
        rawDebts.forEach(debt => {
            const dDate = debt.createdAt instanceof Date ? debt.createdAt : (debt.createdAt?.toDate ? debt.createdAt.toDate() : new Date(debt.createdAt));
            if (dateFrom && dDate < dateFrom) return;
            if (dateTo && dDate > dateTo) return;
            if (type && ((type === 'credit' && debt.type !== 'loaned_in') || (type === 'debit' && debt.type !== 'loaned_out'))) return;
            if (categoryId) return; // Debts don't have categories in reports usually, or we could group them

            virtualEntries.push({
                id: `debt_${debt.id}`,
                type: debt.type === 'loaned_in' ? 'credit' : 'debit',
                amount: debt.amount,
                note: `[Loan] ${debt.personName}: ${debt.note || ''}`,
                date: debt.createdAt,
                category: { name: 'Loans' }
            });
        });

        // 2. Process Loan Payments
        rawPayments.forEach(payment => {
            const pDate = payment.date instanceof Date ? payment.date : (payment.date?.toDate ? payment.date.toDate() : new Date(payment.date));
            if (dateFrom && pDate < dateFrom) return;
            if (dateTo && pDate > dateTo) return;

            const debt = rawDebts.find(d => d.id === payment.debtId);
            if (!debt) return;

            const pType = debt.type === 'loaned_in' ? 'debit' : 'credit';
            if (type && type !== pType) return;
            if (categoryId) return;

            virtualEntries.push({
                id: `pay_${payment.id}`,
                type: pType,
                amount: payment.amount,
                note: `[Payment] ${debt.personName}: ${payment.note || ''}`,
                date: payment.date,
                category: { name: 'Loan Payments' }
            });
        });

        // 3. Process Utilities (Paid Bills)
        rawUtilities.forEach(util => {
            // Only show paid utilities as ledger entries (Cash-Out)
            if (util.status !== 'paid') return;

            // Use paidAt if available, otherwise fallback to dueDate or createdAt to guess when it was paid
            // For older records without paidAt, dueDate is the best proxy we have for "Cash Out" timing relation
            // unless we want to assume they were just paid "now" (which is wrong for history).
            let uDate = util.dueDate instanceof Date ? util.dueDate : (util.dueDate?.toDate ? util.dueDate.toDate() : new Date(util.dueDate));

            if (util.paidAt) {
                uDate = util.paidAt instanceof Date ? util.paidAt : (util.paidAt?.toDate ? util.paidAt.toDate() : new Date(util.paidAt));
            }

            if (dateFrom && uDate < dateFrom) return;
            if (dateTo && uDate > dateTo) return;
            if (type && type !== 'debit') return; // Utilities are usually expenses (debit)

            // Category logic: The USER requested the Category Column to show "Utility"
            // AND the Name/Title to show "Name - SubCategory".
            virtualEntries.push({
                id: `util_${util.id}`,
                type: 'debit',
                amount: util.amount,
                note: `[Bill] ${util.name} - ${util.category || 'General'}`,
                date: uDate, // Use the resolved date
                category: { name: 'Utility' }
            });
        });

        // 4. Process Other Expenses (Paid)
        const rawOtherExpenses = await getAllDocs<FirestoreExpense>('other_expenses', { orderBy: 'dueDate', orderDirection: 'desc' });

        rawOtherExpenses.forEach(expense => {
            if (expense.status !== 'paid') return;

            let eDate = expense.dueDate instanceof Date ? expense.dueDate : (expense.dueDate?.toDate ? expense.dueDate.toDate() : new Date(expense.dueDate));

            if (expense.paidAt) {
                eDate = expense.paidAt instanceof Date ? expense.paidAt : (expense.paidAt?.toDate ? expense.paidAt.toDate() : new Date(expense.paidAt));
            }

            if (dateFrom && eDate < dateFrom) return;
            if (dateTo && eDate > dateTo) return;
            if (type && type !== 'debit') return;

            virtualEntries.push({
                id: `exp_${expense.id}`,
                type: 'debit',
                amount: expense.amount,
                note: `[Expense] ${expense.name} - ${expense.category || 'General'}`,
                date: eDate,
                category: { name: 'Other Expense' }
            });
        });

        // Merge and sort (skip virtual entries when viewing trash — trash only has real ledger records)
        entries = [...entries, ...(showDeleted ? [] : virtualEntries)].sort((a, b) => {
            const da = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
            const db = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
            return db.getTime() - da.getTime();
        });

        // Filter by partyName if provided (Strict match in note)
        if (partyName) {
            const partyLower = partyName.toLowerCase();
            entries = entries.filter(entry => {
                const note = (entry.note || "").toLowerCase();
                return note.includes(`supplier: ${partyLower}`) ||
                    note.includes(`customer: ${partyLower}`);
            });
        }

        // Filter by search term if provided (case-insensitive)
        if (search) {
            const searchLower = search.toLowerCase();
            entries = entries.filter(entry =>
                entry.note?.toLowerCase().includes(searchLower) ||
                (entry.orderNumber && String(entry.orderNumber).includes(searchLower)) ||
                entry.category?.name?.toLowerCase().includes(searchLower)
            );
        }

        const total = entries.length;
        const skip = (page - 1) * limit;
        const paginatedEntries = entries.slice(skip, skip + limit);

        // Batch-fetch categories for all entries (avoids N+1 queries)
        const uniqueCatIds = [...new Set(
            paginatedEntries
                .filter((e: any) => e.categoryId && !e.category)
                .map((e: any) => String(e.categoryId))
        )];

        const catMap = new Map<string, any>();
        if (uniqueCatIds.length > 0) {
            const { getCachedLedgerCategory, getCachedCategory } = await import('@/lib/inventory');
            await Promise.all(uniqueCatIds.map(async (catId) => {
                let cat = await getCachedLedgerCategory(catId);
                if (!cat) cat = await getCachedCategory(catId);
                if (cat) catMap.set(catId, cat);
            }));
        }

        const entriesWithCategories = paginatedEntries.map((entry: any) => {
            if (entry.category) return entry;
            return { ...entry, category: entry.categoryId ? catMap.get(String(entry.categoryId)) || null : null };
        });

        const payload: {
            data: typeof entriesWithCategories;
            meta: {
                total: number;
                page: number;
                limit: number;
                totalPages: number;
                debug?: unknown;
            };
        } = {
            data: entriesWithCategories,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };

        if (process.env.NODE_ENV !== 'production') {
            payload.meta.debug = { filters: { type, categoryId, from, to, search } };
        }

        return NextResponse.json(payload);
    } catch (error: any) {
        console.error("Error fetching ledger entries:", error);

        // Code 8 is RESOURCE_EXHAUSTED
        if (error?.code === 8 || error?.code === 'RESOURCE_EXHAUSTED') {
            return NextResponse.json(
                { error: "System busy, please try again later" },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: "Failed to fetch ledger entries" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const body = await req.json();
        const { type, amount, categoryId, note, date } = body;

        // Validation
        if (!type || (type !== "debit" && type !== "credit")) {
            return NextResponse.json(
                { error: "Type must be 'debit' or 'credit'" },
                { status: 400 }
            );
        }

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { error: "Amount must be greater than 0" },
                { status: 400 }
            );
        }

        // Category is optional — must reference ledger_categories (FK constraint)
        // If the categoryId is from the inventory categories table, clear it to avoid FK violation
        let validCategoryId: string | null = null;
        if (categoryId) {
            const isLedgerCategory = !!(await getDocById<FirestoreLedgerCategory>('ledger_categories', categoryId));
            if (isLedgerCategory) {
                validCategoryId = categoryId;
            }
            // If it's an inventory category, we accept the entry but don't set the FK
            // (the item's own categoryId tracks the inventory category)
        }

        // Extract Order Number from Note if present
        let orderNumber = null;
        if (note) {
            const match = note.match(/Order #(\d+)/);
            if (match) {
                orderNumber = parseInt(match[1], 10);
            }
        }

        // Uniqueness Check for Order Number
        if (orderNumber) {
            const existingEntries = await queryDocs<FirestoreLedger>('ledger', [{ field: 'orderNumber', operator: '==', value: orderNumber }]);
            if (existingEntries.length > 0) {
                return NextResponse.json(
                    { error: `Order #${orderNumber} already exists. Please start a new transaction.` },
                    { status: 409 }
                );
            }
        }

        const { createDoc } = await import('@/lib/prisma-helpers');

        // --- Stock Update Logic Preparation ---
        // Fetch item details to determine conversion factor and units
        const { itemId, quantity } = body;
        let conversionFactor = 1;

        if (itemId) {
            try {
                const itemDoc = await getDocById<FirestoreItem>('items', itemId);
                if (itemDoc && itemDoc.conversionFactor) {
                    conversionFactor = itemDoc.conversionFactor;
                }
            } catch (e) {
                // Conversion factor fetch failed — default to 1
            }
        }

        const entryData: Omit<FirestoreLedger, 'id'> = {
            type: type as 'debit' | 'credit',
            amount: Number(amount),
            categoryId: validCategoryId,
            itemId: itemId || null,
            quantity: quantity ? Number(quantity) : null,
            note: note || null,
            orderNumber: orderNumber || null,
            status: 'open',
            date: date ? new Date(date) : new Date(),
            createdAt: new Date(),
        };

        const entryId = await createDoc<Omit<FirestoreLedger, 'id'>>('ledger', entryData);

        if (itemId && quantity && Number(quantity) > 0) {
            try {
                // Determine stock flow direction
                // Credit (Cash-In) = Sale = Stock OUT
                // Debit (Cash-Out) = Purchase = Stock IN
                const stockType = type === 'credit' ? 'out' : 'in';

                // Calculate quantity in Base Unit
                // If it's a Sale (credit), usually quantity is in Sale Unit.
                // We assume the frontend sends quantity in the selected unit.
                // Ideally, we should know which unit was used.
                // Assuming 'quantity' is in Sale Unit if conversionFactor > 1? 
                // Or we apply conversionFactor if it exists?
                // Standard logic: input quantity * conversionFactor = base quantity
                const contentQty = Number(quantity) * conversionFactor;

                const stockLogData: any = {
                    itemId: String(itemId),
                    type: stockType,
                    quantityBaseUnit: contentQty,
                    description: `Auto-generated from Ledger ${type} entry #${entryId}`,
                    createdAt: new Date(),
                };

                await createDoc('stock_logs', stockLogData);
            } catch (stockError) {
                console.error("Failed to update stock log:", stockError);
                // We don't fail the whole request if stock update fails, but we log it.
            }
        }
        // --------------------------

        const entry = await getDocById<FirestoreLedger>('ledger', entryId);

        // Invalidate daily cache and refresh dashboard stats
        const todayStr = new Date().toISOString().split("T")[0];
        invalidateCache(`daily-summary:${todayStr}`);
        invalidateCacheByPrefix("ledger-balance:");
        await Promise.all([
            invalidateStatsCache("ledger_balance_suppliers_v1"),
            invalidateStatsCache("ledger_balance_customers_v1"),
        ]);
        triggerDashboardStatsRefresh();

        return NextResponse.json(entry, { status: 201 });
    } catch (error) {
        console.error("Error creating ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to create ledger entry" },
            { status: 500 }
        );
    }
}
