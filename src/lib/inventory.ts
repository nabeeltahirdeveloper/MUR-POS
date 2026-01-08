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

    if (!item) return false;

    const stock = currentStock ?? await calculateCurrentStock(itemId);

    // Check item-specific threshold first
    if (item.minStockLevel !== null && item.minStockLevel !== undefined) {
        return stock <= item.minStockLevel;
    }

    // Fallback to global settings
    const settings = await getDocById<any>("settings", "global");

    if (settings && settings.inventory && typeof settings.inventory.globalMinStockLevel === 'number' && settings.inventory.enableLowStockAlerts) {
        return stock <= settings.inventory.globalMinStockLevel;
    }

    return false;
}
