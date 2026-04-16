/**
 * Prisma-based drop-in replacement for firestore-helpers.ts
 *
 * Exports the same function signatures so API routes can switch
 * by changing one import line.
 */

import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────

export const SAFE_LIMIT = 500;

export function safeLimit(limit?: number | null): number {
    return Math.min(Math.max(Number(limit) || 20, 1), SAFE_LIMIT);
}

// ─── Model Registry ──────────────────────────────────────────
// Maps Firestore collection names to Prisma delegates

type PrismaDelegate = {
    findMany: (args?: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
};

// Models that use string IDs (not autoincrement int)
const STRING_ID_MODELS = new Set(["users", "reminders"]);

function getModel(collection: string): PrismaDelegate {
    const p = prisma as any;
    const map: Record<string, PrismaDelegate> = {
        categories: p.category,
        items: p.item,
        units: p.unit,
        unit_conversions: p.unitConversion,
        stock_logs: p.stockLog,
        suppliers: p.supplier,
        customers: p.customer,
        purchase_orders: p.purchaseOrder,
        purchase_order_items: p.purchaseOrderItem,
        ledger: p.ledger,
        ledger_categories: p.ledgerCategory,
        debts: p.debt,
        debt_payments: p.debtPayment,
        utilities: p.utility,
        other_expenses: p.otherExpense,
        reminders: p.reminder,
        cron_runs: p.cronRun,
        system_settings: p.systemSetting,
    };

    const model = map[collection];
    if (!model) throw new Error(`Unknown collection: ${collection}`);
    return model;
}

// ─── Field name mapping ──────────────────────────────────────
// Firestore uses camelCase field names, Prisma also uses camelCase
// but some fields need mapping for orderBy/filter

function mapFieldName(_collection: string, field: string): string {
    // Most fields are identical between Firestore and Prisma
    // Add specific mappings here if needed
    const fieldMap: Record<string, string> = {
        quantityBaseUnit: "quantityBaseUnit",
    };
    return fieldMap[field] || field;
}

// ─── Result conversion ───────────────────────────────────────

function convertResult(record: any): any {
    if (!record) return null;
    const result: any = { ...record };

    // Convert all Prisma Decimal to number
    for (const key of Object.keys(result)) {
        if (result[key] instanceof Prisma.Decimal) {
            result[key] = result[key].toNumber();
        }
    }

    // Ensure ID is always a string
    if (result.id !== undefined) {
        result.id = String(result.id);
    }

    return result;
}

function convertResults(records: any[]): any[] {
    return records.map(convertResult);
}

// ─── Parse ID for where clause ───────────────────────────────

function parseId(collection: string, id: string): string | number {
    if (STRING_ID_MODELS.has(collection)) return id;
    const num = parseInt(id, 10);
    return isNaN(num) ? id : num;
}

// ─── Filter operator mapping ─────────────────────────────────

function buildWhere(
    collection: string,
    filters: Array<{
        field: string;
        operator: string;
        value: any;
    }>
): Record<string, any> {
    const where: Record<string, any> = {};

    for (const filter of filters) {
        const field = mapFieldName(collection, filter.field);
        // Convert Timestamp/Date objects to plain Date
        let value = filter.value;
        if (value && typeof value === "object" && typeof value.toDate === "function") {
            value = value.toDate();
        }
        // Auto-parse string IDs to integers for FK fields (e.g., categoryId, itemId, supplierId)
        if (typeof value === "string" && /Id$/.test(field) && /^\d+$/.test(value)) {
            value = parseInt(value, 10);
        }

        switch (filter.operator) {
            case "==":
                where[field] = value;
                break;
            case "!=":
                where[field] = { not: value };
                break;
            case ">":
                where[field] = { ...(where[field] || {}), gt: value };
                break;
            case ">=":
                where[field] = { ...(where[field] || {}), gte: value };
                break;
            case "<":
                where[field] = { ...(where[field] || {}), lt: value };
                break;
            case "<=":
                where[field] = { ...(where[field] || {}), lte: value };
                break;
            case "in":
                where[field] = { in: value };
                break;
            case "array-contains":
                where[field] = { has: value };
                break;
            default:
                where[field] = value;
        }
    }

    return where;
}

// ─── Timestamp compatibility shim ────────────────────────────
// Legacy: routes still import Timestamp.fromDate(). It's a no-op passthrough.
// TODO: Remove once all callers are updated to pass Date directly.

export const Timestamp = {
    fromDate(date: Date): Date {
        return date;
    },
    now(): Date {
        return new Date();
    },
};

// ─── Settings cache ──────────────────────────────────────────

let settingsCache: any = null;
let lastSettingsFetch = 0;

export async function getSettings() {
    if (settingsCache && Date.now() - lastSettingsFetch < 60000) {
        return settingsCache;
    }

    const setting = await prisma.systemSetting.findUnique({
        where: { key: "global" },
    });

    settingsCache = setting ? JSON.parse(setting.value) : null;
    lastSettingsFetch = Date.now();

    return settingsCache;
}

// ─── Clean data for Prisma write ─────────────────────────────

function cleanDataForWrite(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...data };

    // Remove id from write data (Prisma handles it)
    delete result.id;

    // Remove undefined values
    for (const key of Object.keys(result)) {
        if (result[key] === undefined) delete result[key];
    }

    // Auto-parse string IDs to integers for FK fields (e.g., categoryId, itemId, supplierId)
    for (const key of Object.keys(result)) {
        if (/Id$/.test(key) && typeof result[key] === "string" && /^\d+$/.test(result[key])) {
            result[key] = parseInt(result[key], 10);
        }
    }

    // Convert Firestore Timestamp objects to Date
    for (const key of Object.keys(result)) {
        if (result[key] && typeof result[key] === "object" && typeof result[key].toDate === "function") {
            result[key] = result[key].toDate();
        }
        // Convert date strings to Date objects for DateTime fields
        if (typeof result[key] === "string" && /^\d{4}-\d{2}-\d{2}/.test(result[key])) {
            const d = new Date(result[key]);
            if (!isNaN(d.getTime())) {
                result[key] = d;
            }
        }
    }

    return result;
}

// ─── CRUD Functions ──────────────────────────────────────────

export async function getDocById<T extends Record<string, any>>(
    collection: string,
    id: string
): Promise<(T & { id: string }) | null> {
    const model = getModel(collection);
    const record = await model.findUnique({
        where: { id: parseId(collection, id) },
    });
    if (!record) return null;
    return convertResult(record) as T & { id: string };
}

export async function getAllDocs<T extends Record<string, any>>(
    collection: string,
    options?: { orderBy?: string; orderDirection?: "asc" | "desc"; limit?: number }
): Promise<(T & { id: string })[]> {
    const model = getModel(collection);
    const args: any = {};

    if (options?.orderBy) {
        const field = mapFieldName(collection, options.orderBy);
        args.orderBy = { [field]: options.orderDirection || "asc" };
    }

    if (options?.limit != null) {
        args.take = safeLimit(options.limit);
    }

    const records = await model.findMany(args);
    return convertResults(records) as (T & { id: string })[];
}

export async function createDoc<T extends Record<string, any>>(
    collection: string,
    data: T,
    id?: string
): Promise<string> {
    const model = getModel(collection);
    const cleanData = cleanDataForWrite(data as any);

    if (id && STRING_ID_MODELS.has(collection)) {
        cleanData.id = id;
    }

    const created = await model.create({ data: cleanData });
    return String(created.id);
}

export async function updateDoc<T extends Partial<Record<string, any>>>(
    collection: string,
    id: string,
    data: T
): Promise<void> {
    const model = getModel(collection);
    const cleanData = cleanDataForWrite(data as any);

    await model.update({
        where: { id: parseId(collection, id) },
        data: cleanData,
    });
}

export async function deleteDoc(collection: string, id: string): Promise<void> {
    const model = getModel(collection);
    await model.delete({
        where: { id: parseId(collection, id) },
    });
}

export async function queryDocs<T extends Record<string, any>>(
    collection: string,
    filters: Array<{
        field: string;
        operator:
            | "<"
            | "<="
            | "=="
            | ">"
            | ">="
            | "!="
            | "array-contains"
            | "in"
            | "array-contains-any";
        value: any;
    }>,
    options?: { orderBy?: string; orderDirection?: "asc" | "desc"; limit?: number }
): Promise<(T & { id: string })[]> {
    const model = getModel(collection);
    const where = buildWhere(collection, filters);
    const args: any = { where };

    if (options?.orderBy) {
        const field = mapFieldName(collection, options.orderBy);
        args.orderBy = { [field]: options.orderDirection || "asc" };
    }

    if (options?.limit != null) {
        args.take = safeLimit(options.limit);
    }

    const records = await model.findMany(args);
    return convertResults(records) as (T & { id: string })[];
}

export async function getPagedDocs<T extends Record<string, any>>(
    collection: string,
    options: {
        orderBy: string;
        orderDirection?: "asc" | "desc";
        limit?: number;
        startAfter?: any[];
    }
): Promise<{ docs: (T & { id: string })[]; lastDoc: any | null }> {
    const model = getModel(collection);
    const field = mapFieldName(collection, options.orderBy);
    const pageSize = safeLimit(options.limit ?? 20);

    const args: any = {
        orderBy: [
            { [field]: options.orderDirection || "asc" },
            { id: "asc" },
        ],
        take: pageSize,
    };

    // Cursor-based pagination using startAfter values
    if (options.startAfter?.length) {
        const [orderValue, lastId] = options.startAfter;
        // Use cursor-based pagination
        args.where = {
            OR: [
                { [field]: { gt: orderValue } },
                {
                    [field]: orderValue,
                    id: { gt: STRING_ID_MODELS.has(collection) ? lastId : parseInt(lastId, 10) },
                },
            ],
        };
    }

    const records = await model.findMany(args);
    const docs = convertResults(records) as (T & { id: string })[];
    const lastDoc = docs.length ? docs[docs.length - 1] : null;

    return { docs, lastDoc };
}

