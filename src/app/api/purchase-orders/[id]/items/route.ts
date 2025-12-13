import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        const body = await request.json();
        const { items } = body; // Array of { itemId, qty, pricePerUnit }

        if (!Array.isArray(items)) {
            return NextResponse.json(
                { error: "Items must be an array" },
                { status: 400 }
            );
        }

        const currentPO = await prisma.purchaseOrder.findUnique({
            where: { id },
        });

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
                itemId: parseInt(item.itemId),
                qty: qty,
                pricePerUnit: price
            };
        });

        const updatedPO = await prisma.$transaction(async (tx) => {
            // Delete old items
            await tx.purchaseOrderItem.deleteMany({
                where: { orderId: id }
            });

            // Insert new items
            if (cleanItems.length > 0) {
                await tx.purchaseOrderItem.createMany({
                    data: cleanItems
                });
            }

            // Update PO total
            return await tx.purchaseOrder.update({
                where: { id },
                data: { totalAmount },
                include: {
                    items: { include: { item: true } },
                    supplier: true
                }
            });
        });

        return NextResponse.json(updatedPO);

    } catch (error: any) {
        console.error("Error updating purchase order items:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update purchase order items" },
            { status: 500 }
        );
    }
}
