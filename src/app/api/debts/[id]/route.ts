import { NextRequest, NextResponse } from "next/server";
import { updateDoc, deleteDoc, getDocById, queryDocs, softDeleteDoc } from "@/lib/prisma-helpers";
import { auth } from "@/auth";
import type { ApiDebt, ApiDebtPayment } from "@/types/models";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { isSystemLocked } from "@/lib/lock";

export const runtime = "nodejs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const debt = await getDocById<ApiDebt>('debts', id);
        if (!debt || debt.deletedAt) {
            return NextResponse.json({ error: "Debt not found" }, { status: 404 });
        }

        const payments = await queryDocs<ApiDebtPayment>('debt_payments', [
            { field: 'debtId', operator: '==', value: id }
        ]);

        return NextResponse.json({ ...debt, payments });
    } catch (error) {
        console.error("Error fetching debt details:", error);
        return NextResponse.json(
            { error: "Failed to fetch debt details" },
            { status: 500 }
        );
    }
}

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
        const { personName, amount, dueDate, note, status } = body;

        const updateData: Partial<ApiDebt> = {};
        if (personName !== undefined) updateData.personName = personName;
        if (amount !== undefined) updateData.amount = Number(amount);
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (note !== undefined) updateData.note = note;
        if (status !== undefined) updateData.status = status;

        await updateDoc('debts', id, updateData);

        // Auto-correct status based on actual payments
        if (amount !== undefined || status !== undefined) {
            const payments = await queryDocs<ApiDebtPayment>('debt_payments', [
                { field: 'debtId', operator: '==', value: id }
            ]);
            const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const debt = await getDocById<ApiDebt>('debts', id);
            if (debt) {
                const correctStatus = totalPaid >= Number(debt.amount) ? 'paid' : 'active';
                if (debt.status !== correctStatus) {
                    await updateDoc('debts', id, { status: correctStatus });
                }
            }
        }

        // Sync reminders if due date or status changed
        const { syncDebtReminders } = await import("@/lib/reminders");
        await syncDebtReminders(id).catch(err => {
            console.error("Failed to sync reminders for updated debt:", err);
        });

        const updated = await getDocById<ApiDebt>('debts', id);
        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating debt:", error);
        return NextResponse.json(
            { error: "Failed to update debt" },
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
        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const session = await auth();
        const deletedByUser = session?.user?.email || session?.user?.name || 'unknown';

        // Delete associated reminders
        const { deleteDebtReminders } = await import("@/lib/reminders");
        await deleteDebtReminders(id).catch(err => {
            console.error("Failed to delete reminders for debt:", err);
        });

        await softDeleteDoc('debts', id, deletedByUser);
        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting debt:", error);
        return NextResponse.json(
            { error: "Failed to delete debt" },
            { status: 500 }
        );
    }
}
