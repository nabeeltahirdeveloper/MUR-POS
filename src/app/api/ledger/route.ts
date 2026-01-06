import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Timestamp } from "@/lib/firestore";
import { queryDocs, getDocById, getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreCategory, FirestoreDebt, FirestoreDebtPayment, FirestoreUtility } from "@/types/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
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

        // Fetch everything relevant
        const [rawLedger, rawDebts, rawPayments, rawUtilities] = await Promise.all([
            filters.length > 0
                ? queryDocs<FirestoreLedger>('ledger', filters).catch(() => { usedFallback = true; return getAllDocs<FirestoreLedger>('ledger'); })
                : getAllDocs<FirestoreLedger>('ledger'),
            getAllDocs<FirestoreDebt>('debts'),
            getAllDocs<FirestoreDebtPayment>('debt_payments'),
            getAllDocs<FirestoreUtility>('utilities')
        ]);

        entries = rawLedger;

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

            const uDate = util.dueDate instanceof Date ? util.dueDate : (util.dueDate?.toDate ? util.dueDate.toDate() : new Date(util.dueDate));
            if (dateFrom && uDate < dateFrom) return;
            if (dateTo && uDate > dateTo) return;
            if (type && type !== 'debit') return; // Utilities are usually expenses (debit)

            virtualEntries.push({
                id: `util_${util.id}`,
                type: 'debit',
                amount: util.amount,
                note: `[Bill] ${util.name}`,
                date: util.dueDate,
                category: { name: util.category || 'Utility' }
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
                    category = await getDocById<FirestoreLedgerCategory>('ledger_categories', entry.categoryId);
                    if (!category) {
                        category = await getDocById<FirestoreCategory>('categories', entry.categoryId);
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
    } catch (error) {
        console.error("Error fetching ledger entries:", error);
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

        const { createDoc } = await import('@/lib/firestore-helpers');
        const entryData: Omit<FirestoreLedger, 'id'> = {
            type: type as 'debit' | 'credit',
            amount: Number(amount),
            categoryId: categoryId || null,
            note: note || null,
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
