import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);

        const currentPO = await prisma.purchaseOrder.findUnique({
            where: { id },
        });

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

        const updatedPO = await prisma.purchaseOrder.update({
            where: { id },
            data: { status: "cancelled" },
        });

        return NextResponse.json(updatedPO);
    } catch (error) {
        console.error("Error cancelling purchase order:", error);
        return NextResponse.json(
            { error: "Failed to cancel purchase order" },
            { status: 500 }
        );
    }
}
