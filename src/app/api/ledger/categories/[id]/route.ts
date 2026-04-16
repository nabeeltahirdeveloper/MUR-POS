import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById, updateDoc, queryDocs, deleteDoc } from "@/lib/prisma-helpers";
import type { FirestoreLedgerCategory, FirestoreLedger } from "@/types/firestore";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Category name is required" },
                { status: 400 }
            );
        }

        const trimmedName = name.trim();

        // Check if name exists for another category
        const existing = await queryDocs<FirestoreLedgerCategory>('ledger_categories', [
            { field: 'name', operator: '==', value: trimmedName }
        ]);

        if (existing.length > 0 && existing[0].id !== id) {
            return NextResponse.json(
                { error: "Category name already exists" },
                { status: 409 }
            );
        }

        await updateDoc<Partial<FirestoreLedgerCategory>>('ledger_categories', id, {
            name: trimmedName,
        });

        const updatedCategory = await getDocById<FirestoreLedgerCategory>('ledger_categories', id);
        if (!updatedCategory) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json(updatedCategory);
    } catch (error) {
        console.error("Error updating ledger category:", error);
        return NextResponse.json(
            { error: "Failed to update category" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Check usage
        const usage = await queryDocs<FirestoreLedger>('ledger', [
            { field: 'categoryId', operator: '==', value: id }
        ]);

        if (usage.length > 0) {
            return NextResponse.json(
                {
                    error: `Cannot delete category: It is used in ${usage.length} ledger entries.`,
                },
                { status: 400 }
            );
        }

        await deleteDoc('ledger_categories', id);

        return NextResponse.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting ledger category:", error);
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        );
    }
}
