import { db, Timestamp, FieldPath } from "./firebase-admin";
import type { firestore } from "firebase-admin";

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
export function timestampToDate(
    timestamp: firestore.Timestamp | Date | null | undefined
): Date | null {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp instanceof Timestamp) return timestamp.toDate();
    return null;
}

/**
 * ✅ SAFE_LIMIT now only used when you explicitly pass `limit`
 * (No default limit will be applied in getAllDocs/queryDocs)
 */
export const SAFE_LIMIT = 500;

export function safeLimit(limit?: number | null): number {
    return Math.min(Math.max(Number(limit) || 20, 1), SAFE_LIMIT);
}

let settingsCache: any = null;
let lastSettingsFetch = 0;

export async function getSettings() {
    if (settingsCache && Date.now() - lastSettingsFetch < 60000) {
        return settingsCache;
    }

    const doc = await db.collection("settings").doc("main").get();
    settingsCache = doc.data();
    lastSettingsFetch = Date.now();

    return settingsCache;
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
export function dateToTimestamp(
    date: Date | string | null | undefined
): firestore.Timestamp | null {
    if (!date) return null;
    if (date instanceof Date) return Timestamp.fromDate(date);
    if (typeof date === "string") return Timestamp.fromDate(new Date(date));
    return null;
}

/**
 * Convert Firestore document to plain object with proper type conversions
 */
export function docToObject<T extends Record<string, any>>(
    doc: firestore.DocumentSnapshot,
    options: { convertTimestamps?: boolean; convertDecimals?: boolean } = {}
): T & { id: string } {
    const { convertTimestamps = true, convertDecimals = true } = options;
    const data = doc.data();

    if (!data) {
        return { id: doc.id } as T & { id: string };
    }

    const result: any = { id: doc.id, ...data };

    if (convertTimestamps) {
        Object.keys(result).forEach((key) => {
            if (result[key] instanceof Timestamp) {
                result[key] = result[key].toDate();
            }
        });
    }

    if (convertDecimals) {
        // placeholder for decimal conversion logic if needed
    }

    return result as T & { id: string };
}

/**
 * Convert array of Firestore documents to array of objects
 */
export function docsToArray<T extends Record<string, any>>(
    snapshot: firestore.QuerySnapshot,
    options?: { convertTimestamps?: boolean; convertDecimals?: boolean }
): (T & { id: string })[] {
    return snapshot.docs.map((doc) => docToObject<T>(doc, options));
}

/**
 * Convert object to Firestore-compatible format
 */
export function objectToFirestore<T extends Record<string, any>>(
    obj: T,
    options: { convertDates?: boolean } = {}
): Record<string, any> {
    const { convertDates = true } = options;
    const result: Record<string, any> = { ...obj };

    if (convertDates) {
        Object.keys(result).forEach((key) => {
            if (result[key] instanceof Date) {
                result[key] = Timestamp.fromDate(result[key]);
            } else if (
                typeof result[key] === "string" &&
                /^\d{4}-\d{2}-\d{2}/.test(result[key])
            ) {
                const date = new Date(result[key]);
                if (!isNaN(date.getTime())) {
                    result[key] = Timestamp.fromDate(date);
                }
            }
        });
    }

    // Remove undefined values (Firestore doesn't support undefined)
    Object.keys(result).forEach((key) => {
        if (result[key] === undefined) delete result[key];
    });

    return result;
}

/**
 * Get a document by ID
 */
export async function getDocById<T extends Record<string, any>>(
    collection: string,
    id: string
): Promise<(T & { id: string }) | null> {
    const doc = await db.collection(collection).doc(id).get();
    if (!doc.exists) return null;
    return docToObject<T>(doc);
}

/**
 * ✅ Get all documents from a collection (NO DEFAULT LIMIT)
 * - If you pass options.limit => limit applied (safeLimit)
 * - If you don't pass limit => fetch ALL
 */
export async function getAllDocs<T extends Record<string, any>>(
    collection: string,
    options?: { orderBy?: string; orderDirection?: "asc" | "desc"; limit?: number }
): Promise<(T & { id: string })[]> {
    let query: firestore.Query = db.collection(collection);

    if (options?.orderBy) {
        query = query.orderBy(options.orderBy, options.orderDirection || "asc");
    }

    // ✅ Only apply limit when explicitly provided
    if (options?.limit != null) {
        query = query.limit(safeLimit(options.limit));
    }

    const snapshot = await query.get();
    return docsToArray<T>(snapshot);
}

/**
 * Create a new document
 */
export async function createDoc<T extends Record<string, any>>(
    collection: string,
    data: T,
    id?: string
): Promise<string> {
    const firestoreData = objectToFirestore(data);

    if (id) {
        await db.collection(collection).doc(id).set(firestoreData);
        return id;
    } else {
        const docRef = await db.collection(collection).add(firestoreData);
        return docRef.id;
    }
}

/**
 * Update a document
 */
export async function updateDoc<T extends Partial<Record<string, any>>>(
    collection: string,
    id: string,
    data: T
): Promise<void> {
    const firestoreData = objectToFirestore(data);
    await db.collection(collection).doc(id).update(firestoreData);
}

/**
 * Delete a document
 */
export async function deleteDoc(collection: string, id: string): Promise<void> {
    await db.collection(collection).doc(id).delete();
}

/**
 * ✅ Query documents with filters (NO DEFAULT LIMIT)
 * - If you pass options.limit => limit applied
 * - Otherwise => fetch ALL matching docs
 */
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
    let query: firestore.Query = db.collection(collection);

    filters.forEach((filter) => {
        query = query.where(filter.field, filter.operator, filter.value);
    });

    if (options?.orderBy) {
        query = query.orderBy(options.orderBy, options.orderDirection || "asc");
    }

    // ✅ Only apply limit when explicitly provided
    if (options?.limit != null) {
        query = query.limit(safeLimit(options.limit));
    }

    const snapshot = await query.get();
    return docsToArray<T>(snapshot);
}

/**
 * Pagination helper (kept as-is)
 * - limit is required here because it's paging
 */
export async function getPagedDocs<T extends Record<string, any>>(
    collection: string,
    options: {
        orderBy: string;
        orderDirection?: "asc" | "desc";
        limit?: number;
        startAfter?: any[]; // values according to orderBy fields
    }
): Promise<{ docs: (T & { id: string })[]; lastDoc: firestore.DocumentSnapshot | null }> {
    let query: firestore.Query = db.collection(collection);

    query = query.orderBy(options.orderBy, options.orderDirection || "asc");

    // ✅ stable ordering (avoid duplicates/missing when orderNumber same)
    query = query.orderBy(FieldPath.documentId());

    if (options.startAfter?.length) {
        query = query.startAfter(...options.startAfter);
    }

    const pageSize = safeLimit(options.limit ?? 20);
    query = query.limit(pageSize);

    const snapshot = await query.get();

    const docs = snapshot.docs.map((doc) => docToObject<T>(doc));
    const lastDoc = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null;

    return { docs, lastDoc };
}
