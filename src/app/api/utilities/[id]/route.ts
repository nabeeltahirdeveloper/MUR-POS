import { NextRequest, NextResponse } from "next/server";
import { updateDoc, deleteDoc, getDocById } from "@/lib/firestore-helpers";
import type { FirestoreUtility } from "@/types/firestore";

export const runtime = "nodejs";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const { name, amount, dueDate, category, status } = body;

        const updateData: Partial<FirestoreUtility> = {};
        if (name !== undefined) updateData.name = name;
        if (amount !== undefined) updateData.amount = Number(amount);
        if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
        if (category !== undefined) updateData.category = category;
        if (status !== undefined) updateData.status = status;

        // Check if this is a payment (status changing to paid)
        const existingUtility = await getDocById<FirestoreUtility>('utilities', id);
        const isPayment = existingUtility && existingUtility.status === 'unpaid' && status === 'paid';

        await updateDoc('utilities', id, updateData);

        // If paying a bill, create a ledger entry
        if (isPayment && existingUtility) {
            try {
                const { createDoc } = await import('@/lib/firestore-helpers');
                const ledgerEntry = {
                    type: 'debit' as const,
                    amount: existingUtility.amount,
                    categoryId: null,
                    note: `Utility payment: ${existingUtility.name}${existingUtility.category ? ` (${existingUtility.category})` : ''}`,
                    date: new Date(),
                    createdAt: new Date(),
                };
                await createDoc('ledger', ledgerEntry);
                console.log(`Created ledger entry for utility payment: ${existingUtility.name}`);
            } catch (ledgerError) {
                console.error("Failed to create ledger entry for utility payment:", ledgerError);
                // Don't fail the whole request if ledger creation fails
            }
        }

        // Sync reminders if due date or status changed
        const { syncUtilityReminders } = await import("@/lib/reminders");
        await syncUtilityReminders(id).catch(err => {
            console.error("Failed to sync reminders for updated utility:", err);
        });

        const updated = await getDocById<FirestoreUtility>('utilities', id);
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating utility:", error);
        return NextResponse.json(
            { error: "Failed to update utility" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        await deleteDoc('utilities', id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting utility:", error);
        return NextResponse.json(
            { error: "Failed to delete utility" },
            { status: 500 }
        );
    }
}
