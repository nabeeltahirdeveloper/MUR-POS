import { NextRequest, NextResponse } from "next/server";
import { getDocById, updateDoc } from "@/lib/firestore-helpers";
import type { FirestorePurchaseOrder } from "@/types/firestore";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const body = await request.json();
        const { status } = body;

        if (!["pending", "approved", "cancelled"].includes(status)) {
            // 'received' must go through /receive endpoint
            return NextResponse.json(
                { error: "Invalid status or use /receive for receiving goods" },
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
                { error: "Cannot change status of a final Purchase Order" },
                { status: 400 }
            );
        }

        await updateDoc<Partial<FirestorePurchaseOrder>>('purchase_orders', id, {
            status: status as any,
        });

        const updatedPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);

        return NextResponse.json(updatedPO);
    } catch (error) {
        console.error("Error updating purchase order status:", error);
        return NextResponse.json(
            { error: "Failed to update purchase order status" },
            { status: 500 }
        );
    }
}
