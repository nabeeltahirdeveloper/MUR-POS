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

        const id = String(itemId);
        const qtyToRemove = Number(quantity);

        if (qtyToRemove <= 0) {
            return NextResponse.json(
                { error: "Quantity must be greater than 0" },
                { status: 400 }
            );
        }

        // Check available stock
        const currentStock = await calculateCurrentStock(id);

        if (currentStock < qtyToRemove) {
            return NextResponse.json(
                {
                    error: `Insufficient stock. Current stock: ${currentStock}, Requested: ${qtyToRemove}`,
                },
                { status: 400 }
            );
        }

        // Create OUT log
        const logData: Omit<FirestoreStockLog, 'id'> = {
            itemId: id,
            type: "out",
            quantityBaseUnit: qtyToRemove,
            description: description || null,
            createdAt: new Date(),
        };

        await createDoc<Omit<FirestoreStockLog, 'id'>>('stock_logs', logData);

        // Return updated stock
        const newStock = currentStock - qtyToRemove;

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
