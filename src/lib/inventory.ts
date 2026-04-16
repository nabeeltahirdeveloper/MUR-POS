import { queryDocs, getDocById, getSettings } from "./prisma-helpers";
import type { FirestoreStockLog, FirestoreItem } from "@/types/firestore";

// Cache for items to reduce reads during repeated checks
const itemCache: Record<string, { data: FirestoreItem; timestamp: number }> = {};
const CACHE_TTL = 60000 * 5; // 5 minutes

export async function getCachedItem(itemId: string): Promise<FirestoreItem | null> {
    const cached = itemCache[itemId];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const item = await getDocById<FirestoreItem>('items', itemId);
    if (item) {
        itemCache[itemId] = { data: item, timestamp: Date.now() };
    }
    return item;
}

const categoryCache: Record<string, { data: any; timestamp: number }> = {};
const ledgerCategoryCache: Record<string, { data: any; timestamp: number }> = {};

export async function getCachedCategory(id: string): Promise<any> {
    const cached = categoryCache[id];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    const doc = await getDocById('categories', id);
    if (doc) categoryCache[id] = { data: doc, timestamp: Date.now() };
    return doc;
}

export async function getCachedLedgerCategory(id: string): Promise<any> {
    const cached = ledgerCategoryCache[id];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    const doc = await getDocById('ledger_categories', id);
    if (doc) ledgerCategoryCache[id] = { data: doc, timestamp: Date.now() };
    return doc;
}

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
    const item = await getCachedItem(String(itemId));

    if (!item) return false;

    const stock = currentStock ?? await calculateCurrentStock(itemId);

    // Check item-specific threshold first
    if (item.minStockLevel !== null && item.minStockLevel !== undefined) {
        return stock <= item.minStockLevel;
    }

    // Fallback to global settings
    const settings = await getSettings();

    if (settings && settings.inventory && typeof settings.inventory.globalMinStockLevel === 'number' && settings.inventory.enableLowStockAlerts) {
        return stock <= settings.inventory.globalMinStockLevel;
    }

    return false;
}
