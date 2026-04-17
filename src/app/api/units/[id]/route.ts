
import { NextResponse } from "next/server";
import { updateDoc, deleteDoc, getDocById, queryDocs, softDeleteDoc } from "@/lib/prisma-helpers";
import { auth } from "@/auth";
import type { FirestoreUnit } from "@/types/firestore";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await req.json();
        const { name, symbol } = body;
        const { id } = await params;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Unit name is required" },
                { status: 400 }
            );
        }

        const trimmedName = name.trim();
        const trimmedSymbol = symbol ? symbol.trim() : "";

        // Check if unit exists
        const currentUnit = await getDocById<FirestoreUnit>('units', id);
        if (!currentUnit) {
            return NextResponse.json(
                { error: "Unit not found" },
                { status: 404 }
            );
        }

        // Check for duplicate name if name is changing
        if (trimmedName.toLowerCase() !== currentUnit.name.toLowerCase()) {
            const existing = await queryDocs<FirestoreUnit>('units', [
                { field: 'name', operator: '==', value: trimmedName }
            ]);

            if (existing.length > 0) {
                return NextResponse.json(
                    { error: "Unit name already exists" },
                    { status: 409 }
                );
            }
        }

        await updateDoc('units', id, {
            name: trimmedName,
            symbol: trimmedSymbol
        });

        const updatedUnit = await getDocById<FirestoreUnit>('units', id);

        return NextResponse.json(updatedUnit);
    } catch (error) {
        console.error("Error updating unit:", error);
        return NextResponse.json(
            { error: "Failed to update unit" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if unit exists
        const currentUnit = await getDocById<FirestoreUnit>('units', id);
        if (!currentUnit) {
            return NextResponse.json(
                { error: "Unit not found" },
                { status: 404 }
            );
        }

        // Optional: Check if unit is in use by any items before deleting
        // This would require a query on items collection. 
        // For now, we will allow deletion but ideally should block it.
        const itemsUsingBase = await queryDocs('items', [{ field: 'baseUnitId', operator: '==', value: id }]);
        const itemsUsingSale = await queryDocs('items', [{ field: 'saleUnitId', operator: '==', value: id }]);

        if (itemsUsingBase.length > 0 || itemsUsingSale.length > 0) {
            return NextResponse.json(
                { error: "Cannot delete unit because it is assigned to items." },
                { status: 400 }
            );
        }

        const session = await auth();
        const deletedByUser = session?.user?.email || session?.user?.name || 'unknown';
        await softDeleteDoc('units', id, deletedByUser);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting unit:", error);
        return NextResponse.json(
            { error: "Failed to delete unit" },
            { status: 500 }
        );
    }
}
