import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreItem } from "@/types/firestore";

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

        if (!entry) {
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

        const { id } = await params;
        const body = await req.json();
        const { type, amount, categoryId, note, date, status, markPaid, itemId, quantity } = body;

        const currentEntry = await getDocById<FirestoreLedger>('ledger', id);
        if (!currentEntry) {
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
            updateData.type = type;
        }

        if (amount !== undefined) {
            if (amount <= 0) {
                return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
            }
            updateData.amount = Number(amount);
        }

        if (categoryId !== undefined) {
            let categoryExists: boolean = false;
            if (categoryId) {
                // Check Ledger Categories
                categoryExists = !!(await getDocById<FirestoreLedgerCategory>('ledger_categories', categoryId));
                if (!categoryExists) {
                    // Check Inventory Categories
                    const { getDocById } = await import('@/lib/firestore-helpers');
                    // Note: getDocById is already imported top-level but ensuring type safety/scope
                    // Actually better to use the top level import.
                    // Re-using Top Level import for checking 'categories'
                    const invCat = await getDocById('categories', categoryId);
                    categoryExists = !!invCat;
                }
            } else {
                // categoryId is null/empty, valid as 'no category'
                categoryExists = true;
            }

            if (!categoryExists) {
                return NextResponse.json({ error: "Invalid Category" }, { status: 400 });
            }
            updateData.categoryId = categoryId || null;
        }

        if (note !== undefined) updateData.note = note || null;
        if (date) updateData.date = new Date(date);

        if (itemId !== undefined) updateData.itemId = itemId || null;
        if (quantity !== undefined) updateData.quantity = quantity ? Number(quantity) : null;

        const { updateDoc, createDoc, queryDocs, getDocById: getDoc } = await import('@/lib/firestore-helpers');

        // --- Stock Reconciliation (On Edit) ---
        // If Item, Quantity, or Type has changed, we must adjust stock
        const isItemChanged = itemId !== undefined && itemId !== currentEntry.itemId;
        const isQtyChanged = quantity !== undefined && Number(quantity) !== (currentEntry.quantity || 0); // Handle null qty
        const isTypeChanged = type && type !== currentEntry.type;

        if (isItemChanged || isQtyChanged || isTypeChanged) {
            console.log(`[Ledger Update] Stock change detected for #${id}`);

            // 1. Revert Old Stock Effect
            // Find all logs related to this entry
            const logs = await queryDocs<any>('stock_logs', [
                { field: 'description', operator: '>=', value: `Auto-generated from Ledger` }, // Broad search then filter
            ]);
            // Filter strictly in JS due to Firestore limitation on 'starting with' + other filters sometimes
            // actually we can use the ID check
            const relevantLogs = logs.filter(l => l.description.includes(`#${id}`));

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
                            console.log(`[MarkPaid] Late stock deduction for ${itemId}: ${contentQty}`);
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

        const { id } = await params;
        const { deleteDoc, getDocById, queryDocs, createDoc } = await import('@/lib/firestore-helpers');

        // --- Stock Reconciliation (On Delete) ---
        // Before deleting, find and revert any stock logs created for this entry
        try {
            const currentEntry = await getDocById<FirestoreLedger>('ledger', id);
            if (currentEntry) {
                // Find all logs related to this entry
                const logs = await queryDocs<any>('stock_logs', [
                    { field: 'description', operator: '>=', value: `Auto-generated from Ledger` },
                ]);

                // Filter strictly for this specific ID
                const relevantLogs = logs.filter(l => l.description.includes(`#${id}`));

                for (const log of relevantLogs) {
                    // Revert the effect: if log was 'in', we 'out'
                    const revertType = log.type === 'in' ? 'out' : 'in';
                    await createDoc('stock_logs', {
                        itemId: log.itemId,
                        type: revertType,
                        quantityBaseUnit: log.quantityBaseUnit,
                        description: `Reversion of ${log.type} for DELETED Ledger #${id}`,
                        createdAt: new Date()
                    });
                }
            }
        } catch (err) {
            console.error("Failed to revert stock for deleted ledger entry", err);
            // We continue with deletion even if stock reversion fails to avoid stuck records,
            // but the error is logged.
        }
        // ----------------------------------------

        await deleteDoc('ledger', id);

        return NextResponse.json({ message: "Deleted successfully" });
    } catch (error) {
        console.error("Error deleting ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to delete entry" },
            { status: 500 }
        );
    }
}
