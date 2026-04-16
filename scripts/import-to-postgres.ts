/**
 * Firebase Data Import Script
 *
 * Reads exported JSON files from data/export/ and imports them into PostgreSQL via Prisma.
 * Handles Firestore string ID → PostgreSQL integer ID mapping.
 *
 * Run with: npx tsx scripts/import-to-postgres.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import bcrypt from 'bcrypt';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXPORT_DIR = path.resolve(__dirname, '..', 'data', 'export');

// ID mapping: oldFirestoreId → newPostgresId
const idMaps: Record<string, Map<string, number>> = {};

function getMap(collection: string): Map<string, number> {
    if (!idMaps[collection]) idMaps[collection] = new Map();
    return idMaps[collection];
}

function readExport(collection: string): any[] {
    const filePath = path.join(EXPORT_DIR, `${collection}.json`);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function mapId(collection: string, firestoreId: string | null | undefined): number | null {
    if (!firestoreId) return null;
    const map = getMap(collection);
    const mapped = map.get(firestoreId);
    if (mapped === undefined) {
        console.warn(`  ⚠ Missing ID mapping for ${collection}:${firestoreId}`);
        return null;
    }
    return mapped;
}

function toDate(val: any): Date | null {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

// ─── TIER 1: No foreign keys ──────────────────────────────────

async function importUsers() {
    const docs = readExport('users');
    const defaultPassword = await bcrypt.hash('Admin@123', 10);

    for (const doc of docs) {
        const created = await prisma.user.create({
            data: {
                name: doc.name || 'Unknown',
                email: doc.email,
                passwordHash: defaultPassword,
                role: doc.role || 'admin',
                createdAt: toDate(doc.createdAt) || new Date(),
                emailVerified: toDate(doc.emailVerified),
                image: doc.image || null,
            },
        });
        // Store mapping: firestore string id → prisma cuid string
        // Users use string IDs in both systems
        getMap('users').set(doc.id, created.id as any);
    }
    console.log(`  ✓ users: ${docs.length} imported (default password: Admin@123)`);
}

async function importUnits() {
    const docs = readExport('units');
    for (const doc of docs) {
        const created = await prisma.unit.create({
            data: {
                name: doc.name,
                symbol: doc.symbol || null,
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('units').set(doc.id, created.id);
    }
    console.log(`  ✓ units: ${docs.length} imported`);
}

async function importCategories() {
    const docs = readExport('categories');
    for (const doc of docs) {
        const created = await prisma.category.create({
            data: { name: doc.name },
        });
        getMap('categories').set(doc.id, created.id);
    }
    console.log(`  ✓ categories: ${docs.length} imported`);
}

async function importLedgerCategories() {
    const docs = readExport('ledger_categories');
    for (const doc of docs) {
        const created = await prisma.ledgerCategory.create({
            data: { name: doc.name },
        });
        getMap('ledger_categories').set(doc.id, created.id);
    }
    console.log(`  ✓ ledger_categories: ${docs.length} imported`);
}

async function importSuppliers() {
    const docs = readExport('suppliers');
    for (const doc of docs) {
        const created = await prisma.supplier.create({
            data: {
                name: doc.name,
                phone: doc.phone || null,
                address: doc.address || null,
            },
        });
        getMap('suppliers').set(doc.id, created.id);
    }
    console.log(`  ✓ suppliers: ${docs.length} imported`);
}

async function importCustomers() {
    const docs = readExport('customers');
    for (const doc of docs) {
        const created = await prisma.customer.create({
            data: {
                name: doc.name,
                phone: doc.phone || null,
                address: doc.address || null,
            },
        });
        getMap('customers').set(doc.id, created.id);
    }
    console.log(`  ✓ customers: ${docs.length} imported`);
}

// ─── TIER 2: Depends on Tier 1 ───────────────────────────────

async function importItems() {
    const docs = readExport('items');
    for (const doc of docs) {
        const created = await prisma.item.create({
            data: {
                name: doc.name,
                categoryId: mapId('categories', doc.categoryId),
                baseUnitId: mapId('units', doc.baseUnitId),
                saleUnitId: mapId('units', doc.saleUnitId),
                conversionFactor: doc.conversionFactor ?? 1,
                minStockLevel: doc.minStockLevel ?? 0,
                firstSalePrice: doc.firstSalePrice ?? null,
                secondPurchasePrice: doc.secondPurchasePrice ?? null,
                supplierId: mapId('suppliers', doc.supplierId),
                orderNumber: doc.orderNumber ?? null,
                image: doc.image || null,
                description: doc.description || null,
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('items').set(doc.id, created.id);
    }
    console.log(`  ✓ items: ${docs.length} imported`);
}

async function importUnitConversions() {
    const docs = readExport('unit_conversions');
    for (const doc of docs) {
        const created = await prisma.unitConversion.create({
            data: {
                fromUnitId: mapId('units', doc.fromUnitId)!,
                toUnitId: mapId('units', doc.toUnitId)!,
                factor: doc.factor,
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('unit_conversions').set(doc.id, created.id);
    }
    console.log(`  ✓ unit_conversions: ${docs.length} imported`);
}

// ─── TIER 3: Depends on Tier 2 ───────────────────────────────

async function importStockLogs() {
    const docs = readExport('stock_logs');
    let skipped = 0;
    for (const doc of docs) {
        const itemId = mapId('items', doc.itemId);
        if (!itemId) { skipped++; continue; }
        const created = await prisma.stockLog.create({
            data: {
                itemId,
                type: doc.type,
                quantityBaseUnit: doc.quantityBaseUnit,
                description: doc.description || null,
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('stock_logs').set(doc.id, created.id);
    }
    console.log(`  ✓ stock_logs: ${docs.length - skipped} imported${skipped ? ` (${skipped} skipped - missing item)` : ''}`);
}

async function importPurchaseOrders() {
    const docs = readExport('purchase_orders');
    for (const doc of docs) {
        const created = await prisma.purchaseOrder.create({
            data: {
                supplierId: mapId('suppliers', doc.supplierId),
                status: doc.status || 'draft',
                totalAmount: doc.totalAmount ?? 0,
                notes: doc.notes || null,
                terms: doc.terms || null,
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('purchase_orders').set(doc.id, created.id);
    }
    console.log(`  ✓ purchase_orders: ${docs.length} imported`);
}

async function importDebts() {
    const docs = readExport('debts');
    for (const doc of docs) {
        const created = await prisma.debt.create({
            data: {
                personName: doc.personName,
                type: doc.type,
                amount: doc.amount,
                dueDate: toDate(doc.dueDate),
                note: doc.note || null,
                status: doc.status || 'active',
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('debts').set(doc.id, created.id);
    }
    console.log(`  ✓ debts: ${docs.length} imported`);
}

async function importUtilities() {
    const docs = readExport('utilities');
    for (const doc of docs) {
        const created = await prisma.utility.create({
            data: {
                name: doc.name,
                amount: doc.amount,
                dueDate: toDate(doc.dueDate) || new Date(),
                paidAt: toDate(doc.paidAt),
                category: doc.category || null,
                status: doc.status || 'unpaid',
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('utilities').set(doc.id, created.id);
    }
    console.log(`  ✓ utilities: ${docs.length} imported`);
}

async function importOtherExpenses() {
    const docs = readExport('other_expenses');
    for (const doc of docs) {
        const created = await prisma.otherExpense.create({
            data: {
                name: doc.name,
                amount: doc.amount,
                dueDate: toDate(doc.dueDate) || new Date(),
                paidAt: toDate(doc.paidAt),
                category: doc.category || null,
                status: doc.status || 'unpaid',
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('other_expenses').set(doc.id, created.id);
    }
    console.log(`  ✓ other_expenses: ${docs.length} imported`);
}

// ─── TIER 4: Depends on Tier 3 ───────────────────────────────

async function importPurchaseOrderItems() {
    const docs = readExport('purchase_order_items');
    let skipped = 0;
    for (const doc of docs) {
        const orderId = mapId('purchase_orders', doc.orderId);
        const itemId = mapId('items', doc.itemId);
        if (!orderId || !itemId) { skipped++; continue; }
        const created = await prisma.purchaseOrderItem.create({
            data: {
                orderId,
                itemId,
                qty: doc.qty,
                pricePerUnit: doc.pricePerUnit,
            },
        });
        getMap('purchase_order_items').set(doc.id, created.id);
    }
    console.log(`  ✓ purchase_order_items: ${docs.length - skipped} imported${skipped ? ` (${skipped} skipped)` : ''}`);
}

async function importDebtPayments() {
    const docs = readExport('debt_payments');
    let skipped = 0;
    for (const doc of docs) {
        const debtId = mapId('debts', doc.debtId);
        if (!debtId) { skipped++; continue; }
        const created = await prisma.debtPayment.create({
            data: {
                debtId,
                amount: doc.amount,
                date: toDate(doc.date) || new Date(),
                note: doc.note || null,
            },
        });
        getMap('debt_payments').set(doc.id, created.id);
    }
    console.log(`  ✓ debt_payments: ${docs.length - skipped} imported${skipped ? ` (${skipped} skipped)` : ''}`);
}

async function importLedger() {
    const docs = readExport('ledger');
    for (const doc of docs) {
        const created = await prisma.ledger.create({
            data: {
                type: doc.type,
                amount: doc.amount,
                categoryId: mapId('ledger_categories', doc.categoryId),
                itemId: mapId('items', doc.itemId),
                quantity: doc.quantity ?? null,
                note: doc.note || null,
                orderNumber: doc.orderNumber ?? null,
                status: doc.status || 'open',
                date: toDate(doc.date) || new Date(),
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
        getMap('ledger').set(doc.id, created.id);
    }
    console.log(`  ✓ ledger: ${docs.length} imported`);
}

// ─── TIER 5: Reminders (string IDs) ──────────────────────────

async function importReminders() {
    const docs = readExport('reminders');
    for (const doc of docs) {
        // Reminder source contains { collection, id } - stringify it
        const source = doc.source ? JSON.stringify(doc.source) : null;

        await prisma.reminder.create({
            data: {
                id: doc.id, // Keep original string ID (e.g., "low_stock:abc123")
                type: doc.type,
                referenceId: doc.source?.id || doc.referenceId || null,
                title: doc.title || null,
                source,
                message: doc.message || null,
                triggered: doc.triggered ?? false,
                triggerAt: toDate(doc.triggerAt),
                resolvedAt: toDate(doc.resolvedAt),
                createdAt: toDate(doc.createdAt) || new Date(),
            },
        });
    }
    console.log(`  ✓ reminders: ${docs.length} imported`);
}

// ─── SPECIAL: Settings ────────────────────────────────────────

async function importSettings() {
    const docs = readExport('settings');
    for (const doc of docs) {
        const { id, ...data } = doc;
        await prisma.systemSetting.create({
            data: {
                key: id, // "global", "lock", etc.
                value: JSON.stringify(data),
            },
        });
    }
    console.log(`  ✓ settings: ${docs.length} imported`);
}

// ─── Reset sequences ─────────────────────────────────────────

async function resetSequences() {
    const tables = [
        'units', 'categories', 'items', 'stock_logs', 'suppliers', 'customers',
        'purchase_orders', 'purchase_order_items', 'ledger', 'ledger_categories',
        'debts', 'debt_payments', 'utilities', 'other_expenses', 'cron_runs',
    ];

    for (const table of tables) {
        try {
            await prisma.$executeRawUnsafe(
                `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
            );
        } catch {
            // Table might be empty or not have a sequence
        }
    }
    console.log(`  ✓ autoincrement sequences reset`);
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main() {
    console.log('=== Firebase → PostgreSQL Data Import ===\n');
    console.log(`Reading from: ${EXPORT_DIR}\n`);

    // Tier 1 - No foreign keys
    console.log('Tier 1: Independent tables...');
    await importUsers();
    await importUnits();
    await importCategories();
    await importLedgerCategories();
    await importSuppliers();
    await importCustomers();

    // Tier 2 - Depends on Tier 1
    console.log('\nTier 2: Items & conversions...');
    await importItems();
    await importUnitConversions();

    // Tier 3 - Depends on Tier 2
    console.log('\nTier 3: Stock, orders, debts...');
    await importStockLogs();
    await importPurchaseOrders();
    await importDebts();
    await importUtilities();
    await importOtherExpenses();

    // Tier 4 - Depends on Tier 3
    console.log('\nTier 4: PO items, payments, ledger...');
    await importPurchaseOrderItems();
    await importDebtPayments();
    await importLedger();

    // Tier 5 - Reminders
    console.log('\nTier 5: Reminders...');
    await importReminders();

    // Special
    console.log('\nSpecial: Settings...');
    await importSettings();

    // Reset sequences
    console.log('\nResetting autoincrement sequences...');
    await resetSequences();

    // Summary
    console.log('\n=== Import Summary ===');
    for (const [collection, map] of Object.entries(idMaps)) {
        console.log(`  ${collection}: ${map.size} records mapped`);
    }

    // Save ID mappings for reference
    const mappingsOutput: Record<string, Record<string, number>> = {};
    for (const [collection, map] of Object.entries(idMaps)) {
        mappingsOutput[collection] = Object.fromEntries(map);
    }
    fs.writeFileSync(
        path.join(EXPORT_DIR, '_id_mappings.json'),
        JSON.stringify(mappingsOutput, null, 2),
        'utf-8'
    );
    console.log(`\nID mappings saved to data/export/_id_mappings.json`);

    console.log('\nDone!');
}

main()
    .catch((err) => {
        console.error('Import failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
