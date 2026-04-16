import { NextRequest, NextResponse } from "next/server";
import { updateDoc, deleteDoc, getDocById } from "@/lib/prisma-helpers";
import type { FirestoreUtility } from "@/types/firestore";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { isSystemLocked } from "@/lib/lock";

export const runtime = "nodejs";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

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

        // Capture paidAt date when marking as paid
        if (isPayment) {
            updateData.paidAt = new Date();
        }

        await updateDoc('utilities', id, updateData);

        // If paying a bill, create a ledger entry
        // NOTE: We now use "Virtual Entries" in the Ledger API to display paid utilities.
        // Creating a physical ledger entry here causes duplicates.
        // if (isPayment && existingUtility) {
        //     try {
        //         const { createDoc } = await import('@/lib/prisma-helpers');
        //         const ledgerEntry = {
        //             type: 'debit' as const,
        //             amount: existingUtility.amount,
        //             categoryId: null,
        //             note: `Utility payment: ${existingUtility.name}${existingUtility.category ? ` (${existingUtility.category})` : ''}`,
        //             date: new Date(),
        //             createdAt: new Date(),
        //         };
        //         await createDoc('ledger', ledgerEntry);
        //         console.log(`Created ledger entry for utility payment: ${existingUtility.name}`);
        //     } catch (ledgerError) {
        //         console.error("Failed to create ledger entry for utility payment:", ledgerError);
        //         // Don't fail the whole request if ledger creation fails
        //     }
        // }

        // Sync reminders if due date or status changed
        const { syncUtilityReminders } = await import("@/lib/reminders");
        await syncUtilityReminders(id).catch(err => {
            console.error("Failed to sync reminders for updated utility:", err);
        });

        const updated = await getDocById<FirestoreUtility>('utilities', id);
        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();
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
        // Delete associated reminders first
        const { deleteUtilityReminders } = await import("@/lib/reminders");
        await deleteUtilityReminders(id).catch(err => {
            console.error("Failed to delete reminders for utility:", err);
        });

        await deleteDoc('utilities', id);
        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting utility:", error);
        return NextResponse.json(
            { error: "Failed to delete utility" },
            { status: 500 }
        );
    }
}
