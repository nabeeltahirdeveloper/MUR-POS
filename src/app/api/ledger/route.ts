import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, Timestamp } from "@/lib/firestore";
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

        // Build filters
        const filters: Array<{ field: string; operator: '<' | '<=' | '==' | '>' | '>=' | '!=' | 'array-contains' | 'in' | 'array-contains-any'; value: any }> = [];

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

        // Get all entries (Firestore doesn't support skip/take easily, so we'll fetch all and paginate in memory)
        let entries = filters.length > 0 
            ? await queryDocs<FirestoreLedger>('ledger', filters, {
                orderBy: 'date',
                orderDirection: 'desc',
            })
            : await getAllDocs<FirestoreLedger>('ledger', {
                orderBy: 'date',
                orderDirection: 'desc',
            });

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

        return NextResponse.json({
            data: entriesWithCategories,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
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

        if (!categoryId) {
            return NextResponse.json(
                { error: "Category is required" },
                { status: 400 }
            );
        }

        // Verify category exists
        const categoryExists = await getDocById<FirestoreLedgerCategory>('ledger_categories', categoryId);

        if (!categoryExists) {
            return NextResponse.json(
                { error: "Invalid Category ID" },
                { status: 400 }
            );
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
