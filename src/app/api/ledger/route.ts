import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Timestamp } from "@/lib/firestore";
import { queryDocs, getDocById, getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory } from "@/types/firestore";

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
        let entries: (FirestoreLedger & { id: string })[] = [];
        let usedFallback = false;
        if (filters.length > 0) {
            try {
                entries = await queryDocs<FirestoreLedger>('ledger', filters, {
                    orderBy: 'date',
                    orderDirection: 'desc',
                });
            } catch (queryErr) {
                usedFallback = true;
                console.error('Firestore query failed, falling back to in-memory filtering:', queryErr);
                // Fallback: fetch all and apply filters in memory
                entries = await getAllDocs<FirestoreLedger>('ledger', {
                    orderBy: 'date',
                    orderDirection: 'desc',
                });

                // Apply filters in memory
                entries = entries.filter((entry) => {
                    for (const f of filters) {
                        const field = f.field;
                        const op = f.operator;
                        const val = f.value;

                        if (field === 'date') {
                            const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
                            // Handle both Firestore Timestamp (has .toDate()) and standard Date/string
                            const valUnknown = val as unknown;
                            const hasToDate = valUnknown && typeof (valUnknown as { toDate: unknown }).toDate === 'function';
                            const compDate = hasToDate
                                ? (valUnknown as { toDate: () => Date }).toDate()
                                : new Date(val as string | number | Date);

                            if (op === '>=' && entryDate < compDate) return false;
                            if (op === '<=' && entryDate > compDate) return false;
                        } else if (op === '==') {
                            // simple equality check (convert both to string for safety)
                            // Use Type Assertion for generic property access
                            const entryRecord = entry as unknown as Record<string, unknown>;
                            const entryValue = entryRecord[field];
                            if (String(entryValue) !== String(val)) return false;
                        } else {
                            // unsupported operator in fallback — be conservative and skip the entry
                            return false;
                        }
                    }
                    return true;
                });
            }
        } else {
            entries = await getAllDocs<FirestoreLedger>('ledger', {
                orderBy: 'date',
                orderDirection: 'desc',
            });
        }

        // Filter by search term if provided (case-insensitive)
        if (search) {
            const searchLower = search.toLowerCase();
            entries = entries.filter(entry =>
                entry.note?.toLowerCase().includes(searchLower)
            );
        }

        const total = entries.length;
        const skip = (page - 1) * limit;
        const paginatedEntries = entries.slice(skip, skip + limit);

        // Fetch categories for entries
        const entriesWithCategories = await Promise.all(
            paginatedEntries.map(async (entry) => {
                const category = entry.categoryId
                    ? await getDocById<FirestoreLedgerCategory>('ledger_categories', entry.categoryId)
                    : null;
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
            const categoryExists = await getDocById<FirestoreLedgerCategory>('ledger_categories', categoryId);

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
