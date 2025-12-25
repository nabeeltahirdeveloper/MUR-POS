import { NextRequest, NextResponse } from "next/server";
import { createDoc } from "@/lib/firestore-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import type { FirestoreStockLog } from "@/types/firestore";

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

        const qty = Number(quantity);
        if (qty <= 0) {
            return NextResponse.json(
                { error: "Quantity must be greater than 0" },
                { status: 400 }
            );
        }

        // Create IN log
        const logData: Omit<FirestoreStockLog, 'id'> = {
            itemId: String(itemId),
            type: "in",
            quantityBaseUnit: qty,
            description: description || null,
            createdAt: new Date(),
        };

        await createDoc<Omit<FirestoreStockLog, 'id'>>('stock_logs', logData);

        // Return updated stock
        const currentStock = await calculateCurrentStock(String(itemId));

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
