import { NextRequest, NextResponse } from "next/server";
import { getDocById, queryDocs, createDoc, updateDoc, deleteDoc } from "@/lib/prisma-helpers";
import type { FirestorePurchaseOrder, FirestorePurchaseOrderItem, FirestoreSupplier, FirestoreItem, FirestoreUnit } from "@/types/firestore";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { items } = body; // Array of { itemId, qty, pricePerUnit }

        if (!Array.isArray(items)) {
            return NextResponse.json(
                { error: "Items must be an array" },
                { status: 400 }
            );
        }

        const currentPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);

        if (!currentPO) {
            return NextResponse.json(
                { error: "Purchase Order not found" },
                { status: 404 }
            );
        }

        if (currentPO.status === "received" || currentPO.status === "cancelled") {
            return NextResponse.json(
                { error: "Cannot modify items of Purchase Order in final state" },
                { status: 400 }
            );
        }

        let totalAmount = 0;
        const cleanItems = items.map((item: any) => {
            const qty = parseFloat(item.qty);
            const price = parseFloat(item.pricePerUnit);

            if (isNaN(qty) || qty <= 0) throw new Error("Quantity must be > 0");
            if (isNaN(price) || price < 0) throw new Error("Price must be >= 0");

            totalAmount += qty * price;

            return {
                orderId: id,
                itemId: String(item.itemId),
                qty: qty,
                pricePerUnit: price
            };
        });

        // Delete old items
        const oldItems = await queryDocs<FirestorePurchaseOrderItem>('purchase_order_items', [
            { field: 'orderId', operator: '==', value: id }
        ]);
        
        for (const oldItem of oldItems) {
            await deleteDoc('purchase_order_items', oldItem.id);
        }

        // Insert new items
        for (const item of cleanItems) {
            await createDoc<Omit<FirestorePurchaseOrderItem, 'id'>>('purchase_order_items', item);
        }

        // Update PO total
        await updateDoc<Partial<FirestorePurchaseOrder>>('purchase_orders', id, {
            totalAmount,
        });

        // Fetch updated PO with relations
        const updatedPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);
        if (!updatedPO) {
            throw new Error('Failed to fetch updated purchase order');
        }

        const supplier = updatedPO.supplierId 
            ? await getDocById<FirestoreSupplier>('suppliers', updatedPO.supplierId)
            : null;

        const poItems = await queryDocs<FirestorePurchaseOrderItem>('purchase_order_items', [
            { field: 'orderId', operator: '==', value: id }
        ]);

        const itemsWithDetails = await Promise.all(
            poItems.map(async (poItem) => {
                const item = await getDocById<FirestoreItem>('items', poItem.itemId);
                return {
                    ...poItem,
                    item,
                };
            })
        );

        return NextResponse.json({
            ...updatedPO,
            supplier,
            items: itemsWithDetails,
        });

    } catch (error: any) {
        console.error("Error updating purchase order items:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update purchase order items" },
            { status: 500 }
        );
    }
}
