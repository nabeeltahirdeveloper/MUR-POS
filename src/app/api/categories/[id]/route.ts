import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById, updateDoc, queryDocs, deleteDoc } from "@/lib/firestore-helpers";
import type { FirestoreCategory, FirestoreItem } from "@/types/firestore";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
        const existing = await queryDocs<FirestoreCategory>('categories', [
            { field: 'name', operator: '==', value: trimmedName }
        ]);

        if (existing.length > 0 && existing[0].id !== id) {
            return NextResponse.json(
                { error: "Category name already exists" },
                { status: 409 }
            );
        }

        await updateDoc<Partial<FirestoreCategory>>('categories', id, {
            name: trimmedName,
        });

        const updatedCategory = await getDocById<FirestoreCategory>('categories', id);
        if (!updatedCategory) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json(updatedCategory);
    } catch (error) {
        console.error("Error updating category:", error);
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
        const { id } = await params;

        // Check usage in items
        const usage = await queryDocs<FirestoreItem>('items', [
            { field: 'categoryId', operator: '==', value: id }
        ]);

        if (usage.length > 0) {
            return NextResponse.json(
                {
                    error: `Cannot delete category: It is used in ${usage.length} items.`,
                },
                { status: 400 }
            );
        }

        await deleteDoc('categories', id);

        return NextResponse.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting category:", error);
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        );
    }
}
