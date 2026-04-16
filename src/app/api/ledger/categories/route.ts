import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllDocs, createDoc, queryDocs } from "@/lib/prisma-helpers";
import type { FirestoreLedgerCategory } from "@/types/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const categories = await getAllDocs<FirestoreLedgerCategory>('ledger_categories', {
            orderBy: 'name',
            orderDirection: 'asc',
        });

        return NextResponse.json(categories);
    } catch (error) {
        console.error("Error fetching ledger categories:", error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
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
        const { name } = body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Category name is required" },
                { status: 400 }
            );
        }

        const trimmedName = name.trim();

        // Check for duplicate
        const existing = await queryDocs<FirestoreLedgerCategory>('ledger_categories', [
            { field: 'name', operator: '==', value: trimmedName }
        ]);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "Category already exists" },
                { status: 409 }
            );
        }

        const categoryId = await createDoc<Omit<FirestoreLedgerCategory, 'id'>>('ledger_categories', {
            name: trimmedName,
        });

        const category = await import('@/lib/prisma-helpers').then(m => m.getDocById<FirestoreLedgerCategory>('ledger_categories', categoryId));

        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        console.error("Error creating ledger category:", error);
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        );
    }
}
