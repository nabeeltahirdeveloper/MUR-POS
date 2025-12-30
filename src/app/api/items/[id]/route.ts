import { NextRequest, NextResponse } from "next/server";
import { getDocById } from "@/lib/firestore-helpers";
import { calculateCurrentStock, checkLowStock } from "@/lib/inventory";
import { syncLowStockReminderForItem } from "@/lib/reminders";
import type { FirestoreItem, FirestoreCategory, FirestoreUnit } from "@/types/firestore";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const {
            name,
            categoryId,
            baseUnitId,
            saleUnitId,
            conversionFactor,
            minStockLevel,
            firstSalePrice,
            secondPurchasePrice,
        } = body;

        // TODO: Add check if we can change units safely if stock exists?
        // Start with basic update.

        const updateData: Partial<FirestoreItem> = {};
        if (name !== undefined) updateData.name = name;
        if (categoryId !== undefined) updateData.categoryId = categoryId || null;
        if (baseUnitId !== undefined) updateData.baseUnitId = baseUnitId || null;
        if (saleUnitId !== undefined) updateData.saleUnitId = saleUnitId || null;
        if (conversionFactor !== undefined) updateData.conversionFactor = conversionFactor ? Number(conversionFactor) : null;
        if (minStockLevel !== undefined) {
            updateData.minStockLevel = (minStockLevel === null || minStockLevel === "")
                ? null
                : Number(minStockLevel);
        }
        if (firstSalePrice !== undefined) {
            updateData.firstSalePrice = (firstSalePrice === null || firstSalePrice === "") ? null : Number(firstSalePrice);
        }
        if (secondPurchasePrice !== undefined) {
            updateData.secondPurchasePrice = (secondPurchasePrice === null || secondPurchasePrice === "") ? null : Number(secondPurchasePrice);
        }

        const { updateDoc } = await import('@/lib/firestore-helpers');
        await updateDoc<Partial<FirestoreItem>>('items', id, updateData);

        // If threshold changed (or item got updated), sync low-stock reminder immediately.
        if (minStockLevel !== undefined || name !== undefined) {
            await syncLowStockReminderForItem(id);
        }

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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { db } = await import('@/lib/firestore');
        const { deleteDoc } = await import('@/lib/firestore-helpers');

        // Get all associated stock logs and purchase order items
        const stockLogsSnapshot = await db.collection('stock_logs')
            .where('itemId', '==', id)
            .get();

        const poItemsSnapshot = await db.collection('purchase_order_items')
            .where('itemId', '==', id)
            .get();

        // Delete associated stock logs
        const stockLogDeletions = stockLogsSnapshot.docs.map(doc => doc.ref.delete());
        
        // Delete associated purchase order items
        const poItemDeletions = poItemsSnapshot.docs.map(doc => doc.ref.delete());

        // Wait for all associated records to be deleted
        await Promise.all([...stockLogDeletions, ...poItemDeletions]);

        // Delete the item itself
        await deleteDoc('items', id);

        const deletedCounts = {
            stockLogs: stockLogsSnapshot.size,
            purchaseOrderItems: poItemsSnapshot.size,
        };

        return NextResponse.json({ 
            message: "Item deleted successfully",
            deletedCounts 
        });
    } catch (error) {
        console.error("Error deleting item:", error);
        return NextResponse.json(
            { error: "Failed to delete item" },
            { status: 500 }
        );
    }
}
