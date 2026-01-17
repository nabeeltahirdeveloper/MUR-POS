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
        const { type, amount, categoryId, note, date } = body;

        const updateData: Partial<FirestoreLedger> = {};

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

        const { updateDoc, createDoc, queryDocs, getDocById: getDoc } = await import('@/lib/firestore-helpers');
        await updateDoc<Partial<FirestoreLedger>>('ledger', id, updateData);

        // --- Mark Paid / Stock Logic ---
        const { markPaid } = body;
        if (markPaid) {
            // Check if we need to deduct stock (Late Deduction)
            // 1. Check if stock log already exists
            try {
                const logs = await queryDocs<any>('stock_logs', [
                    { field: 'description', operator: '==', value: `Auto-generated from Ledger ${type || 'credit'} entry #${id}` }
                ]);

                // Also check for 'debit' if type wasn't passed but it's a credit sale usually.
                // Actually we should match the ledger type.
                // Let's rely on the ledger entry itself if type is missing in body.

                if (logs.length === 0) {
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
        const { deleteDoc } = await import('@/lib/firestore-helpers');
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
