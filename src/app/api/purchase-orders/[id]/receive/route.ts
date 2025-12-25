import { NextRequest, NextResponse } from "next/server";
import { getDocById, queryDocs, updateDoc, createDoc } from "@/lib/firestore-helpers";
import { db } from "@/lib/firestore";
import type { FirestorePurchaseOrder, FirestorePurchaseOrderItem, FirestoreStockLog } from "@/types/firestore";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;

        // Use Firestore batch for atomicity
        const batch = db.batch();

        const po = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);

        if (!po) {
            throw new Error("Purchase Order not found");
        }

        if (po.status === "received") {
            throw new Error("Purchase Order already received");
        }

        if (po.status === "cancelled") {
            throw new Error("Cannot receive a cancelled Purchase Order");
        }

        const poItems = await queryDocs<FirestorePurchaseOrderItem>('purchase_order_items', [
            { field: 'orderId', operator: '==', value: id }
        ]);

        if (poItems.length === 0) {
            throw new Error("Cannot receive a Purchase Order with no items");
        }

        // Update Status
        const poRef = db.collection('purchase_orders').doc(id);
        batch.update(poRef, { status: "received" });

        // Create Stock Logs
        for (const item of poItems) {
            const logRef = db.collection('stock_logs').doc();
            const logData: Omit<FirestoreStockLog, 'id'> = {
                itemId: item.itemId,
                type: "in",
                quantityBaseUnit: item.qty, // Assuming PO qty is in base unit
                description: `Received PO #${id}`,
                createdAt: new Date(),
            };
            batch.set(logRef, logData);
        }

        await batch.commit();

        const updatedPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);

        return NextResponse.json(updatedPO);
    } catch (error: any) {
        console.error("Error receiving purchase order:", error);
        return NextResponse.json(
            { error: error.message || "Failed to receive purchase order" },
            { status: 400 } // Using 400 as mostly it's logic error
        );
    }
}
