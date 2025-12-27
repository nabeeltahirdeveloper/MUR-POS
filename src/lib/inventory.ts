import { queryDocs, getDocById } from "./firestore-helpers";
import type { FirestoreStockLog, FirestoreItem } from "@/types/firestore";

/**
 * Calculates current stock for an item by summing up all stock logs.
 * Returns the quantity in BASE unit.
 */
export async function calculateCurrentStock(itemId: string | number): Promise<number> {
    const logs = await queryDocs<FirestoreStockLog>('stock_logs', [
        { field: 'itemId', operator: '==', value: String(itemId) }
    ]);

    let totalStock = 0;

    for (const log of logs) {
        if (log.type === "in") {
            totalStock += log.quantityBaseUnit;
        } else if (log.type === "out") {
            totalStock -= log.quantityBaseUnit;
        }
    }

    return totalStock;
}

/**
 * Checks if an item is low on stock.
 */
export async function checkLowStock(itemId: string | number, currentStock?: number): Promise<boolean> {
    const item = await getDocById<FirestoreItem>('items', String(itemId));

    if (!item || item.minStockLevel === null || item.minStockLevel === undefined) {
        return false;
    }

    const stock = currentStock ?? await calculateCurrentStock(itemId);

    // If minStockLevel is 0, we might want to consider it low stock only if it's strictly less than 0?
    // Or usually minStock is a threshold. If stock <= minStock, it is low.
    // Requirement says: "Compare with min_stock_level".
    // Let's assume if stock <= minStockLevel, it's low (trigger reorder).

    return stock <= item.minStockLevel;
}
