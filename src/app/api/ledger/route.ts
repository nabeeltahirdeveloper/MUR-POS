import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Timestamp } from "@/lib/firestore";
import { queryDocs, getDocById, getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreCategory, FirestoreDebt, FirestoreDebtPayment, FirestoreUtility, FirestoreExpense } from "@/types/firestore";

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

        // Debug: log incoming params to help diagnose intermittent filtering issues
        console.debug('[ledger GET] params:', { page, limit, type, categoryId, search, from, to });

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

        // Get all entries. Prefer server-side queries, but if Firestore query fails
        // (e.g. requires a composite index) fall back to fetching all and filtering in memory.
        let entries: (any)[] = [];
        let usedFallback = false;

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

        // Fetch everything relevant
        const [rawLedger, rawDebts, rawPayments, rawUtilities] = await Promise.all([
            filters.length > 0
                ? queryDocs<FirestoreLedger>('ledger', filters, { orderBy: 'date', orderDirection: 'desc', limit })
                : getAllDocs<FirestoreLedger>('ledger', { orderBy: 'date', orderDirection: 'desc', limit }),
            getAllDocs<FirestoreDebt>('debts', { orderBy: 'createdAt', orderDirection: 'desc', limit }),
            getAllDocs<FirestoreDebtPayment>('debt_payments', { orderBy: 'date', orderDirection: 'desc', limit }),
            getAllDocs<FirestoreUtility>('utilities', { orderBy: 'dueDate', orderDirection: 'desc', limit })
        ]);

        // Combine specific order search results with general results
        // Use a Map to deduplicate by ID
        const combinedLedger = new Map();
        [...rawLedger, ...specificOrderEntries].forEach(item => combinedLedger.set(item.id, item));
        entries = Array.from(combinedLedger.values());

        // Apply fallback filtering if needed for ledger
        if (usedFallback && filters.length > 0) {
            entries = entries.filter((entry) => {
                for (const f of filters) {
                    const field = f.field;
                    const op = f.operator;
                    const val = f.value;
                    if (field === 'date') {
                        const entryDate = entry.date instanceof Date ? entry.date : (entry.date?.toDate ? entry.date.toDate() : new Date(entry.date));
                        const compDate = (val as any).toDate ? (val as any).toDate() : new Date(val as any);
                        if (op === '>=' && entryDate < compDate) return false;
                        if (op === '<=' && entryDate > compDate) return false;
                    } else if (op === '==') {
                        if (String(entry[field]) !== String(val)) return false;
                    }
                }
                return true;
            });
        }

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
        const rawOtherExpenses = await getAllDocs<FirestoreExpense>('other_expenses', { orderBy: 'dueDate', orderDirection: 'desc', limit });

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

        // Merge and sort
        entries = [...entries, ...virtualEntries].sort((a, b) => {
            const da = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
            const db = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
            return db.getTime() - da.getTime();
        });

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

        // Fetch categories for entries (only for raw ledger entries that don't have it yet)
        const entriesWithCategories = await Promise.all(
            paginatedEntries.map(async (entry) => {
                if (entry.category) return entry; // Already has virtual category

                let category: FirestoreLedgerCategory | FirestoreCategory | null = null;
                if (entry.categoryId) {
                    const { getCachedLedgerCategory, getCachedCategory } = await import('@/lib/inventory');
                    category = await getCachedLedgerCategory(entry.categoryId);
                    if (!category) {
                        category = await getCachedCategory(entry.categoryId);
                    }
                }
                return {
                    ...entry,
                    category,
                };
            })
        );

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
            payload.meta.debug = { filters: { type, categoryId, from, to, search }, usedFallback };
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

        // Category is now optional
        if (categoryId) {
            // Verify category exists if provided
            let categoryExists: boolean = !!(await getDocById<FirestoreLedgerCategory>('ledger_categories', categoryId));

            if (!categoryExists) {
                // Check inventory categories
                categoryExists = !!(await getDocById<FirestoreCategory>('categories', categoryId));
            }

            if (!categoryExists) {
                return NextResponse.json(
                    { error: "Invalid Category ID" },
                    { status: 400 }
                );
            }
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

        const { createDoc } = await import('@/lib/firestore-helpers');
        const entryData: Omit<FirestoreLedger, 'id'> = {
            type: type as 'debit' | 'credit',
            amount: Number(amount),
            categoryId: categoryId || null,
            note: note || null,
            orderNumber: orderNumber || null,
            date: date ? new Date(date) : new Date(),
            createdAt: new Date(),
        };

        const entryId = await createDoc<Omit<FirestoreLedger, 'id'>>('ledger', entryData);

        // --- Stock Update Logic ---
        const { itemId, quantity } = body;

        if (itemId && quantity && Number(quantity) > 0) {
            try {
                // Determine stock flow direction
                // Credit (Cash-In) = Sale = Stock OUT
                // Debit (Cash-Out) = Purchase = Stock IN
                const stockType = type === 'credit' ? 'out' : 'in';

                const stockLogData: any = {
                    itemId: String(itemId),
                    type: stockType,
                    quantityBaseUnit: Number(quantity), // Assuming 1-to-1 for now, or use item conversion factor if needed
                    description: `Auto-generated from Ledger ${type} entry #${entryId}`,
                    createdAt: new Date(),
                };

                await createDoc('stock_logs', stockLogData);
                console.log(`Updated stock for item ${itemId}: ${stockType} ${quantity}`);
            } catch (stockError) {
                console.error("Failed to update stock log:", stockError);
                // We don't fail the whole request if stock update fails, but we log it.
            }
        }
        // --------------------------

        const entry = await getDocById<FirestoreLedger>('ledger', entryId);

        return NextResponse.json(entry, { status: 201 });
    } catch (error) {
        console.error("Error creating ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to create ledger entry" },
            { status: 500 }
        );
    }
}
