import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById } from "@/lib/prisma-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreItem } from "@/types/firestore";
import { isSystemLocked } from "@/lib/lock";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCache, invalidateCacheByPrefix } from "@/lib/server-cache";
import { invalidateStatsCache } from "@/lib/stats-cache";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const entry = await getDocById<FirestoreLedger>('ledger', id);

        if (!entry || entry.deletedAt) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        const category = entry.categoryId
            ? await getDocById<FirestoreLedgerCategory>('ledger_categories', entry.categoryId)
            : null;

        return NextResponse.json({
            ...entry,
            category,
        });
    } catch (error) {
        console.error("Error fetching ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to fetch entry" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const { id } = await params;
        const body = await req.json();
        const { type, amount, categoryId, note, date, status, markPaid, itemId, quantity } = body;

        const currentEntry = await getDocById<FirestoreLedger>('ledger', id);
        if (!currentEntry || currentEntry.deletedAt) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        // Status Check: If Closed, prevent editing unless re-opening
        if (currentEntry.status === 'closed' && status !== 'open') {
            if (type || amount !== undefined || categoryId !== undefined || note !== undefined || date || markPaid || itemId || quantity) {
                return NextResponse.json(
                    { error: "Transaction is closed. Re-open to edit." },
                    { status: 403 }
                );
            }
        }

        const updateData: Partial<FirestoreLedger> = {};

        if (status && (status === 'open' || status === 'closed')) {
            updateData.status = status;
        }

        if (type) {
            if (type !== "debit" && type !== "credit") {
                return NextResponse.json({ error: "Invalid type" }, { status: 400 });
            }
            // Warn if type is being changed on an entry with items (reverses stock flow)
            if (type !== currentEntry.type && currentEntry.itemId && !body.confirmTypeChange) {
                return NextResponse.json(
                    { error: "Changing type will reverse the stock flow for this entry. Send confirmTypeChange: true to proceed.", requiresConfirmation: true },
                    { status: 409 }
                );
            }
            updateData.type = type;
        }

        if (amount !== undefined) {
            if (amount <= 0) {
                return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
            }
            updateData.amount = Number(amount);
        }

        if (categoryId !== undefined) {
            if (categoryId) {
                // Only set categoryId if it exists in ledger_categories (FK constraint)
                const isLedgerCategory = !!(await getDocById<FirestoreLedgerCategory>('ledger_categories', categoryId));
                updateData.categoryId = isLedgerCategory ? categoryId : null;
            } else {
                updateData.categoryId = null;
            }
        }

        if (note !== undefined) updateData.note = note || null;
        if (date) updateData.date = new Date(date);

        if (itemId !== undefined) updateData.itemId = itemId || null;
        if (quantity !== undefined) updateData.quantity = quantity ? Number(quantity) : null;

        const { updateDoc, createDoc, queryDocs, getDocById: getDoc } = await import('@/lib/prisma-helpers');

        // --- Stock Reconciliation (On Edit) ---
        // If Item, Quantity, or Type has changed, we must adjust stock
        const isItemChanged = itemId !== undefined && itemId !== currentEntry.itemId;
        const isQtyChanged = quantity !== undefined && Number(quantity) !== (currentEntry.quantity || 0); // Handle null qty
        const isTypeChanged = type && type !== currentEntry.type;

        if (isItemChanged || isQtyChanged || isTypeChanged) {

            // 1. Revert Old Stock Effect
            // Find all logs related to this entry
            const logs = await queryDocs<any>('stock_logs', [
                { field: 'description', operator: '>=', value: `Auto-generated from Ledger` },
            ]);
            // Use regex with word boundary to avoid #1 matching #10, #11, etc.
            const entryIdPattern = new RegExp(`#${id}\\b`);
            const relevantLogs = logs.filter((l: any) => entryIdPattern.test(l.description));

            for (const log of relevantLogs) {
                // Determine reversion type (if log was 'in', we 'out')
                const revertType = log.type === 'in' ? 'out' : 'in';
                await createDoc('stock_logs', {
                    itemId: log.itemId,
                    type: revertType,
                    quantityBaseUnit: log.quantityBaseUnit,
                    description: `Reversion of ${log.type} for Updated Ledger #${id}`,
                    createdAt: new Date()
                });
            }

            // 2. Apply New Stock Effect
            // Use NEW values or fallback to CURRENT values
            const newItemId = itemId !== undefined ? itemId : currentEntry.itemId;
            const newQuantity = quantity !== undefined ? Number(quantity) : currentEntry.quantity;
            const newType = type || currentEntry.type;

            if (newItemId) {
                try {
                    // Check if item exists and get conversion factor
                    // getDoc is aliased to getDocById from import
                    const itemDoc = await getDoc<FirestoreItem>('items', newItemId);

                    if (itemDoc) {
                        const conversionFactor = itemDoc.conversionFactor || 1;
                        const qtyBase = (newQuantity || 1) * conversionFactor;
                        const stockType = newType === 'credit' ? 'out' : 'in';

                        await createDoc('stock_logs', {
                            itemId: newItemId,
                            type: stockType,
                            quantityBaseUnit: qtyBase,
                            description: `Auto-generated from Ledger ${newType} entry #${id} (Updated)`,
                            createdAt: new Date()
                        });
                    }
                } catch (err) {
                    console.error("Failed to apply new stock for updated ledger", err);
                }
            }
        }

        await updateDoc<Partial<FirestoreLedger>>('ledger', id, updateData);

        // --- Mark Paid / Stock Logic ---
        if (markPaid) {
            // Check if we need to deduct stock (Late Deduction)
            // 1. Check if stock log already exists
            try {
                // Check for ANY stock operation related to this ledger entry
                // This includes the standard "Auto-generated" one AND the "Retroactive deduction" one
                // created by the receive-custom flow.
                const logs = await queryDocs<any>('stock_logs', [
                    { field: 'description', operator: '>=', value: `Auto-generated from Ledger ${type || 'credit'} entry #${id}` },
                    { field: 'description', operator: '<=', value: `Auto-generated from Ledger ${type || 'credit'} entry #${id}\uf8ff` }
                    // Note: Firestore doesn't support logical OR in simple queries easily without multiple queries.
                    // So we might need to do a second check if the first returns empty.
                ]);

                let alreadyDeducted = logs.length > 0;

                if (!alreadyDeducted) {
                    // Check for "Retroactive deduction" pattern
                    const retroactiveLogs = await queryDocs<any>('stock_logs', [
                        { field: 'description', operator: '==', value: `Retroactive deduction for Ledger #${id}` }
                    ]);
                    if (retroactiveLogs.length > 0) {
                        alreadyDeducted = true;
                    }
                }

                if (!alreadyDeducted) {
                    // No stock log found. Proceed to deduct.
                    const currentEntry = await getDoc<FirestoreLedger>('ledger', id);
                    if (currentEntry) {
                        let itemId = currentEntry.itemId;
                        let quantity = currentEntry.quantity || 1;
                        // If quantity is missing but itemId exists, maybe default 1? 

                        // Fallback: Parse Note if itemId missing
                        if (!itemId && currentEntry.note) {
                            // Regex matching: Item: [Type] Name (Qty: X Unit @ Y)
                            const match = currentEntry.note.match(/Item: (?:\[(.*?)\]\s*)?(.*?)\s*\(Qty: (\d+)/);
                            if (match) {
                                const extractedName = match[2].trim();
                                quantity = Number(match[3]) || 1;

                                // Find item by name
                                const items = await queryDocs<any>('items', [{ field: 'name', operator: '==', value: extractedName }]);
                                if (items.length > 0) {
                                    itemId = items[0].id;
                                }
                            }
                        }

                        if (itemId) {
                            // Get Item for Conversion Factor
                            let conversionFactor = 1;
                            const itemDoc = await getDoc<FirestoreItem>('items', itemId);
                            if (itemDoc && itemDoc.conversionFactor) {
                                conversionFactor = itemDoc.conversionFactor;
                            }

                            const stockType = currentEntry.type === 'credit' ? 'out' : 'in';
                            const contentQty = quantity * conversionFactor;

                            await createDoc('stock_logs', {
                                itemId: String(itemId),
                                type: stockType,
                                quantityBaseUnit: contentQty,
                                description: `Auto-generated from Ledger ${currentEntry.type} entry #${id}`,
                                createdAt: new Date()
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to process stock update on Mark Paid", e);
            }
        }
        // -------------------------------

        const updatedEntry = await getDocById<FirestoreLedger>('ledger', id);
        if (!updatedEntry) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        // Refresh dashboard stats after edit
        const todayStr = new Date().toISOString().split("T")[0];
        invalidateCache(`daily-summary:${todayStr}`);
        invalidateCacheByPrefix("ledger-balance:");
        await Promise.all([
            invalidateStatsCache("ledger_balance_suppliers_v1"),
            invalidateStatsCache("ledger_balance_customers_v1"),
        ]);
        triggerDashboardStatsRefresh();

        return NextResponse.json(updatedEntry);
    } catch (error) {
        console.error("Error updating ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to update entry" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const { id } = await params;
        const { deleteDoc, getDocById, queryDocs, createDoc, softDeleteDoc } = await import('@/lib/prisma-helpers');
        const deletedByUser = session.user?.email || session.user?.name || 'unknown';

        // 1. Identify entries to delete (either by direct ID or by Order Number)
        let entriesToDelete: (FirestoreLedger & { id: string })[] = [];

        // Try direct ID first
        const directEntry = await getDocById<FirestoreLedger>('ledger', id);
        if (directEntry && !directEntry.deletedAt) {
            entriesToDelete = [directEntry];
        }

        if (entriesToDelete.length === 0) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        // --- Stock Reconciliation (On Delete) ---
        // Before deleting, find and revert any stock logs created for these entries
        try {
            for (const currentEntry of entriesToDelete) {
                const entryId = currentEntry.id;
                // Find all logs related to this specific entry ID
                const logs = await queryDocs<any>('stock_logs', [
                    { field: 'description', operator: '>=', value: `Auto-generated from Ledger` },
                ]);

                // Use regex with word boundary to avoid #1 matching #10, #11, etc.
                const idPattern = new RegExp(`#${entryId}\\b`);
                const relevantLogs = logs.filter((l: any) => idPattern.test(l.description));

                for (const log of relevantLogs) {
                    // Revert the effect: if log was 'in', we 'out'
                    const revertType = log.type === 'in' ? 'out' : 'in';
                    await createDoc('stock_logs', {
                        itemId: log.itemId,
                        type: revertType,
                        quantityBaseUnit: log.quantityBaseUnit,
                        description: `Reversion of ${log.type} for DELETED Ledger #${entryId} (Batch)`,
                        createdAt: new Date()
                    });
                }
            }
        } catch (err) {
            console.error("Failed to revert stock for deleted ledger entries", err);
        }

        // --- Debt Deletion (Sync) ---
        try {
            // Extract potential order number
            const orderNum = entriesToDelete[0]?.orderNumber;
            if (orderNum) {
                const debts = await queryDocs<any>('debts', []);
                const relevantDebts = debts.filter(d => d.note?.includes(`Order #${orderNum}`));
                for (const debt of relevantDebts) {
                    await softDeleteDoc('debts', debt.id, deletedByUser);
                }
            }
        } catch (debtErr) {
            console.error("Failed to sync debt deletion:", debtErr);
        }

        // 2. Soft-delete (mark as deleted, keep record for audit trail)
        for (const entry of entriesToDelete) {
            await softDeleteDoc('ledger', entry.id, deletedByUser);
        }

        // Refresh dashboard stats after delete
        const todayStr = new Date().toISOString().split("T")[0];
        invalidateCache(`daily-summary:${todayStr}`);
        invalidateCacheByPrefix("ledger-balance:");
        // Also clear DB-persisted stats cache so recomputation uses fresh data
        await Promise.all([
            invalidateStatsCache("ledger_balance_suppliers_v1"),
            invalidateStatsCache("ledger_balance_customers_v1"),
        ]);
        triggerDashboardStatsRefresh();

        return NextResponse.json({ message: "Deleted successfully" });
    } catch (error) {
        console.error("Error deleting ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to delete entry" },
            { status: 500 }
        );
    }
}
