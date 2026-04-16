import { NextRequest, NextResponse } from "next/server";
import { updateDoc, deleteDoc, getDocById, queryDocs } from "@/lib/prisma-helpers";
import type { FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";
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
        const debt = await getDocById<FirestoreDebt>('debts', id);
        if (!debt) {
            return NextResponse.json({ error: "Debt not found" }, { status: 404 });
        }

        const payments = await queryDocs<FirestoreDebtPayment>('debt_payments', [
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

        const updateData: Partial<FirestoreDebt> = {};
        if (personName !== undefined) updateData.personName = personName;
        if (amount !== undefined) updateData.amount = Number(amount);
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (note !== undefined) updateData.note = note;
        if (status !== undefined) updateData.status = status;

        await updateDoc('debts', id, updateData);

        // Auto-correct status based on actual payments
        if (amount !== undefined || status !== undefined) {
            const payments = await queryDocs<FirestoreDebtPayment>('debt_payments', [
                { field: 'debtId', operator: '==', value: id }
            ]);
            const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const debt = await getDocById<FirestoreDebt>('debts', id);
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

        const updated = await getDocById<FirestoreDebt>('debts', id);
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

        // Optional: Delete associated payments first
        const payments = await queryDocs<FirestoreDebtPayment>('debt_payments', [
            { field: 'debtId', operator: '==', value: id }
        ]);

        for (const payment of payments) {
            await deleteDoc('debt_payments', payment.id);
        }

        // Delete associated reminders
        const { deleteDebtReminders } = await import("@/lib/reminders");
        await deleteDebtReminders(id).catch(err => {
            console.error("Failed to delete reminders for debt:", err);
        });

        await deleteDoc('debts', id);
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
