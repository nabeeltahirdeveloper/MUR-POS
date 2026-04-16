import { NextRequest, NextResponse } from "next/server";
import { getDocById, queryDocs, updateDoc, createDoc } from "@/lib/prisma-helpers";
import type { FirestorePurchaseOrder, FirestorePurchaseOrderItem, FirestoreStockLog } from "@/types/firestore";
import { syncLowStockReminderForItem } from "@/lib/reminders";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

        if (po.status !== "approved") {
            throw new Error("Purchase Order must be approved before receiving");
        }

        const poItems = await queryDocs<FirestorePurchaseOrderItem>('purchase_order_items', [
            { field: 'orderId', operator: '==', value: id }
        ]);

        if (poItems.length === 0) {
            throw new Error("Cannot receive a Purchase Order with no items");
        }

        // Update PO status
        await updateDoc('purchase_orders', id, { status: "received" });

        // Create Stock Logs for each item
        for (const item of poItems) {
            await createDoc('stock_logs', {
                itemId: parseInt(item.itemId, 10),
                type: "in",
                quantityBaseUnit: item.qty,
                description: `Received PO #${id}`,
                createdAt: new Date(),
            });
        }

        // Sync low-stock reminders for affected items
        const uniqueItemIds = Array.from(new Set(poItems.map((i) => String(i.itemId))));
        await Promise.all(uniqueItemIds.map((itemId) => syncLowStockReminderForItem(itemId)));

        const updatedPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);

        return NextResponse.json(updatedPO);
    } catch (error: any) {
        console.error("Error receiving purchase order:", error);
        return NextResponse.json(
            { error: error.message || "Failed to receive purchase order" },
            { status: 400 }
        );
    }
}
