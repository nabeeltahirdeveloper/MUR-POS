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

        const qty = new Prisma.Decimal(quantity);
        if (qty.lessThanOrEqualTo(0)) {
            return NextResponse.json(
                { error: "Quantity must be greater than 0" },
                { status: 400 }
            );
        }

        // Create IN log
        await prisma.stockLog.create({
            data: {
                itemId: parseInt(itemId),
                type: "in",
                quantityBaseUnit: qty,
                description,
            },
        });

        // Return updated stock
        const currentStock = await calculateCurrentStock(parseInt(itemId));

        return NextResponse.json({
            message: "Stock added successfully",
            currentStock,
        });
    } catch (error) {
        console.error("Error adding stock:", error);
        return NextResponse.json(
            { error: "Failed to add stock" },
            { status: 500 }
        );
    }
}
