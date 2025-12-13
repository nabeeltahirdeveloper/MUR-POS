import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Calculates current stock for an item by summing up all stock logs.
 * Returns the quantity in BASE unit.
 */
export async function calculateCurrentStock(itemId: number): Promise<Prisma.Decimal> {
    const logs = await prisma.stockLog.findMany({
        where: { itemId },
        select: {
            type: true,
            quantityBaseUnit: true,
        },
    });

    let totalStock = new Prisma.Decimal(0);

    for (const log of logs) {
        if (log.type === "in") {
            totalStock = totalStock.plus(log.quantityBaseUnit);
        } else if (log.type === "out") {
            totalStock = totalStock.minus(log.quantityBaseUnit);
        }
    }

    return totalStock;
}

/**
 * Checks if an item is low on stock.
 */
export async function checkLowStock(itemId: number, currentStock?: Prisma.Decimal): Promise<boolean> {
    const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { minStockLevel: true },
    });

    if (!item || item.minStockLevel === null) {
        return false;
    }

    const stock = currentStock ?? await calculateCurrentStock(itemId);

    // If minStockLevel is 0, we might want to consider it low stock only if it's strictly less than 0?
    // Or usually minStock is a threshold. If stock <= minStock, it is low.
    // Requirement says: "Compare with min_stock_level".
    // Let's assume if stock <= minStockLevel, it's low (trigger reorder).

    return stock.lessThanOrEqualTo(item.minStockLevel);
}
