import { NextRequest, NextResponse } from "next/server";
import { getDocById, updateDoc } from "@/lib/prisma-helpers";
import type { ApiPurchaseOrder } from "@/types/models";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const currentPO = await getDocById<ApiPurchaseOrder>('purchase_orders', id);

        if (!currentPO) {
            return NextResponse.json(
                { error: "Purchase Order not found" },
                { status: 404 }
            );
        }

        if (currentPO.status === "received") {
            return NextResponse.json(
                { error: "Cannot cancel a received Purchase Order" },
                { status: 400 }
            );
        }

        await updateDoc<Partial<ApiPurchaseOrder>>('purchase_orders', id, {
            status: "cancelled",
        });

        const updatedPO = await getDocById<ApiPurchaseOrder>('purchase_orders', id);

        return NextResponse.json(updatedPO);
    } catch (error) {
        console.error("Error cancelling purchase order:", error);
        return NextResponse.json(
            { error: "Failed to cancel purchase order" },
            { status: 500 }
        );
    }
}
