import { NextRequest, NextResponse } from "next/server";
import { getDocById } from "@/lib/firestore-helpers";
import { calculateCurrentStock, checkLowStock } from "@/lib/inventory";
import type { FirestoreItem, FirestoreCategory, FirestoreUnit } from "@/types/firestore";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const item = await getDocById<FirestoreItem>('items', id);

        if (!item) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        // Fetch related data
        const [category, baseUnit, saleUnit] = await Promise.all([
            item.categoryId ? getDocById<FirestoreCategory>('categories', item.categoryId) : null,
            item.baseUnitId ? getDocById<FirestoreUnit>('units', item.baseUnitId) : null,
            item.saleUnitId ? getDocById<FirestoreUnit>('units', item.saleUnitId) : null,
        ]);

        const currentStock = await calculateCurrentStock(item.id);
        const isLowStock = await checkLowStock(item.id, currentStock);

        return NextResponse.json({
            ...item,
            category,
            baseUnit,
            saleUnit,
            currentStock,
            isLowStock,
        });
    } catch (error) {
        console.error("Error fetching item:", error);
        return NextResponse.json(
            { error: "Failed to fetch item" },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const body = await request.json();
        const {
            name,
            categoryId,
            baseUnitId,
            saleUnitId,
            conversionFactor,
            minStockLevel,
        } = body;

        // TODO: Add check if we can change units safely if stock exists?
        // Start with basic update.

        const updateData: Partial<FirestoreItem> = {};
        if (name !== undefined) updateData.name = name;
        if (categoryId !== undefined) updateData.categoryId = categoryId || null;
        if (baseUnitId !== undefined) updateData.baseUnitId = baseUnitId || null;
        if (saleUnitId !== undefined) updateData.saleUnitId = saleUnitId || null;
        if (conversionFactor !== undefined) updateData.conversionFactor = conversionFactor ? Number(conversionFactor) : null;
        if (minStockLevel !== undefined) updateData.minStockLevel = minStockLevel ? Number(minStockLevel) : null;

        const { updateDoc } = await import('@/lib/firestore-helpers');
        await updateDoc<Partial<FirestoreItem>>('items', id, updateData);

        // Fetch updated item with relations
        const updatedItem = await getDocById<FirestoreItem>('items', id);
        if (!updatedItem) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        const [category, baseUnit, saleUnit] = await Promise.all([
            updatedItem.categoryId ? getDocById<FirestoreCategory>('categories', updatedItem.categoryId) : null,
            updatedItem.baseUnitId ? getDocById<FirestoreUnit>('units', updatedItem.baseUnitId) : null,
            updatedItem.saleUnitId ? getDocById<FirestoreUnit>('units', updatedItem.saleUnitId) : null,
        ]);

        return NextResponse.json({
            ...updatedItem,
            category,
            baseUnit,
            saleUnit,
        });
    } catch (error) {
        console.error("Error updating item:", error);
        return NextResponse.json(
            { error: "Failed to update item" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const { db } = await import('@/lib/firestore');

        // Check for dependencies
        const stockLogsSnapshot = await db.collection('stock_logs')
            .where('itemId', '==', id)
            .limit(1)
            .get();

        const poItemsSnapshot = await db.collection('purchase_order_items')
            .where('itemId', '==', id)
            .limit(1)
            .get();

        if (!stockLogsSnapshot.empty || !poItemsSnapshot.empty) {
            return NextResponse.json(
                {
                    error:
                        "Cannot delete item because it has associated stock logs or purchase orders. Archive it instead.",
                },
                { status: 400 }
            );
        }

        const { deleteDoc } = await import('@/lib/firestore-helpers');
        await deleteDoc('items', id);

        return NextResponse.json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Error deleting item:", error);
        return NextResponse.json(
            { error: "Failed to delete item" },
            { status: 500 }
        );
    }
}
