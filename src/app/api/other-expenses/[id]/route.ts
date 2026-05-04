import { NextRequest, NextResponse } from "next/server";
import { updateDoc, deleteDoc, getDocById, softDeleteDoc } from "@/lib/prisma-helpers";
import { auth } from "@/auth";
import type { ApiExpense } from "@/types/models";
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

        const updateData: Partial<ApiExpense> = {};
        if (name !== undefined) updateData.name = name;
        if (amount !== undefined) updateData.amount = Number(amount);
        if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
        if (category !== undefined) updateData.category = category;
        if (status !== undefined) updateData.status = status;

        // Check if this is a payment (status changing to paid)
        const existingExpense = await getDocById<ApiExpense>('other_expenses', id);
        const isPayment = existingExpense && existingExpense.status === 'unpaid' && status === 'paid';

        // Capture paidAt date when marking as paid
        if (isPayment) {
            updateData.paidAt = new Date();
        }

        await updateDoc('other_expenses', id, updateData);

        const updated = await getDocById<ApiExpense>('other_expenses', id);
        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating other expense:", error);
        return NextResponse.json(
            { error: "Failed to update other expense" },
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
        const session = await auth();
        const deletedByUser = session?.user?.email || session?.user?.name || 'unknown';
        await softDeleteDoc('other_expenses', id, deletedByUser);
        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting other expense:", error);
        return NextResponse.json(
            { error: "Failed to delete other expense" },
            { status: 500 }
        );
    }
}
