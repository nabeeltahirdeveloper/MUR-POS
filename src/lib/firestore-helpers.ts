import { db } from './firebase-admin';
import { Timestamp, Query, DocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
export function timestampToDate(timestamp: Timestamp | Date | null | undefined): Date | null {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp instanceof Timestamp) return timestamp.toDate();
    return null;
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
export function dateToTimestamp(date: Date | string | null | undefined): Timestamp | null {
    if (!date) return null;
    if (date instanceof Date) return Timestamp.fromDate(date);
    if (typeof date === 'string') return Timestamp.fromDate(new Date(date));
    return null;
}

/**
 * Convert Firestore document to plain object with proper type conversions
 */
export function docToObject<T extends Record<string, any>>(
    doc: DocumentSnapshot,
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
        // Firestore stores numbers as numbers, but we might need to handle Decimal types
        // This is a placeholder for any decimal conversion logic if needed
    }

    return result as T & { id: string };
}

/**
 * Convert array of Firestore documents to array of objects
 */
export function docsToArray<T extends Record<string, any>>(
    snapshot: QuerySnapshot,
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
            } else if (typeof result[key] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(result[key])) {
                // Try to parse date strings
                const date = new Date(result[key]);
                if (!isNaN(date.getTime())) {
                    result[key] = Timestamp.fromDate(date);
                }
            }
        });
    }

    // Remove undefined values (Firestore doesn't support undefined)
    Object.keys(result).forEach((key) => {
        if (result[key] === undefined) {
            delete result[key];
        }
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
 * Get all documents from a collection
 */
export async function getAllDocs<T extends Record<string, any>>(
    collection: string,
    options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' }
): Promise<(T & { id: string })[]> {
    let query: Query = db.collection(collection);
    
    if (options?.orderBy) {
        query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
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
 * Query documents with filters
 */
export async function queryDocs<T extends Record<string, any>>(
    collection: string,
    filters: Array<{ field: string; operator: '<' | '<=' | '==' | '>' | '>=' | '!=' | 'array-contains' | 'in' | 'array-contains-any'; value: any }>,
    options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number }
): Promise<(T & { id: string })[]> {
    let query: Query = db.collection(collection);

    filters.forEach((filter) => {
        query = query.where(filter.field, filter.operator, filter.value);
    });

    if (options?.orderBy) {
        query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return docsToArray<T>(snapshot);
}

