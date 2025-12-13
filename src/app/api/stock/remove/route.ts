import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentStock } from "@/lib/inventory";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { itemId, quantity, description } = body;

        if (!itemId || !quantity) {
            return NextResponse.json(
                { error: "Item ID and Quantity are required" },
                { status: 400 }
            );
        }

        const id = parseInt(itemId);
        const qtyToRemove = new Prisma.Decimal(quantity);

        if (qtyToRemove.lessThanOrEqualTo(0)) {
            return NextResponse.json(
                { error: "Quantity must be greater than 0" },
                { status: 400 }
            );
        }

        // Check available stock
        const currentStock = await calculateCurrentStock(id);

        if (currentStock.lessThan(qtyToRemove)) {
            return NextResponse.json(
                {
                    error: `Insufficient stock. Current stock: ${currentStock.toString()}, Requested: ${qtyToRemove.toString()}`,
                },
                { status: 400 }
            );
        }

        // Create OUT log
        await prisma.stockLog.create({
            data: {
                itemId: id,
                type: "out",
                quantityBaseUnit: qtyToRemove,
                description,
            },
        });

        // Return updated stock
        const newStock = currentStock.minus(qtyToRemove);

        return NextResponse.json({
            message: "Stock removed successfully",
            currentStock: newStock,
        });
    } catch (error) {
        console.error("Error removing stock:", error);
        return NextResponse.json(
            { error: "Failed to remove stock" },
            { status: 500 }
        );
    }
}
