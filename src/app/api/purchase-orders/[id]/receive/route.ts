import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);

        // Transaction to ensure atomicity
        const receivedPO = await prisma.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!po) {
                throw new Error("Purchase Order not found");
            }

            if (po.status === "received") {
                throw new Error("Purchase Order already received");
            }

            if (po.status === "cancelled") {
                throw new Error("Cannot receive a cancelled Purchase Order");
            }

            if (po.items.length === 0) {
                throw new Error("Cannot receive a Purchase Order with no items");
            }

            // Update Status
            const updatedPO = await tx.purchaseOrder.update({
                where: { id },
                data: { status: "received" }
            });

            // Create Stock Logs
            for (const item of po.items) {
                await tx.stockLog.create({
                    data: {
                        itemId: item.itemId,
                        type: "in",
                        quantityBaseUnit: item.qty, // Assuming PO qty is in base unit
                        description: `Received PO #${id}`,
                    }
                });
            }

            return updatedPO;
        });

        return NextResponse.json(receivedPO);
    } catch (error: any) {
        console.error("Error receiving purchase order:", error);
        return NextResponse.json(
            { error: error.message || "Failed to receive purchase order" },
            { status: 400 } // Using 400 as mostly it's logic error
        );
    }
}
