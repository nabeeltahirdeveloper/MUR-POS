/**
 * Firebase Firestore Data Export Script
 *
 * Exports all Firestore collections to local JSON files in data/export/
 * Run with: npx tsx scripts/export-firestore.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey) {
        console.error('Missing FIREBASE_PRIVATE_KEY in .env');
        process.exit(1);
    }
    privateKey = privateKey.trim();
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n').trim();

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
        }),
    });
}

const db = admin.firestore();
const OUTPUT_DIR = path.resolve(__dirname, '..', 'data', 'export');

// All collections to export
const COLLECTIONS = [
    'users',
    'categories',
    'items',
    'units',
    'unit_conversions',
    'stock_logs',
    'suppliers',
    'customers',
    'purchase_orders',
    'purchase_order_items',
    'ledger',
    'ledger_categories',
    'debts',
    'debt_payments',
    'utilities',
    'other_expenses',
    'reminders',
    'settings',
    'stats',
    'cron_runs',
];

/**
 * Convert any Firestore Timestamp fields to ISO strings recursively
 */
function convertTimestamps(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (obj instanceof admin.firestore.Timestamp) {
        return obj.toDate().toISOString();
    }

    if (Array.isArray(obj)) {
        return obj.map(convertTimestamps);
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = convertTimestamps(value);
        }
        return result;
    }

    return obj;
}

async function exportCollection(collectionName: string): Promise<number> {
    const snapshot = await db.collection(collectionName).get();

    const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        const converted = convertTimestamps(data);
        return { id: doc.id, ...converted };
    });

    const filePath = path.join(OUTPUT_DIR, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');

    return docs.length;
}

async function main() {
    console.log('=== Firestore Data Export ===\n');
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const results: { collection: string; count: number }[] = [];
    let totalDocs = 0;

    for (const collection of COLLECTIONS) {
        try {
            const count = await exportCollection(collection);
            results.push({ collection, count });
            totalDocs += count;
            console.log(`  ✓ ${collection}: ${count} documents`);
        } catch (error: any) {
            console.error(`  ✗ ${collection}: ERROR - ${error.message}`);
            results.push({ collection, count: -1 });
        }
    }

    console.log('\n=== Export Summary ===');
    console.log(`Total collections: ${COLLECTIONS.length}`);
    console.log(`Total documents: ${totalDocs}`);
    console.log(`Output: ${OUTPUT_DIR}`);

    // Write a summary file
    const summary = {
        exportedAt: new Date().toISOString(),
        collections: results,
        totalDocuments: totalDocs,
    };
    fs.writeFileSync(
        path.join(OUTPUT_DIR, '_summary.json'),
        JSON.stringify(summary, null, 2),
        'utf-8'
    );

    console.log('\nDone! Check data/export/ for your files.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Export failed:', err);
    process.exit(1);
});
