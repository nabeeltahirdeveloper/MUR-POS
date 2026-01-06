import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory } from "@/types/firestore";

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

        const { updateDoc } = await import('@/lib/firestore-helpers');
        await updateDoc<Partial<FirestoreLedger>>('ledger', id, updateData);

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
