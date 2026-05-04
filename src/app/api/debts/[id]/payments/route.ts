import { NextRequest, NextResponse } from "next/server";
import { createDoc, getDocById, updateDoc, queryDocs } from "@/lib/prisma-helpers";
import type { ApiDebt, ApiDebtPayment } from "@/types/models";
import { isSystemLocked } from "@/lib/lock";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCacheByPrefix } from "@/lib/server-cache";

export const runtime = "nodejs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: debtId } = await params;
    try {
        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const body = await request.json();
        const { amount, date, note } = body;

        if (!amount || Number(amount) <= 0) {
            return NextResponse.json(
                { error: "Payment amount must be greater than 0" },
                { status: 400 }
            );
        }

        const debt = await getDocById<ApiDebt>('debts', debtId);
        if (!debt) {
            return NextResponse.json({ error: "Debt not found" }, { status: 404 });
        }

        if (debt.status === 'paid') {
            return NextResponse.json({ error: "Debt is already fully paid" }, { status: 400 });
        }

        // Check for overpayment
        const existingPayments = await queryDocs<ApiDebtPayment>('debt_payments', [
            { field: 'debtId', operator: '==', value: debtId }
        ]);
        const alreadyPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const remaining = Number(debt.amount) - alreadyPaid;

        if (Number(amount) > remaining) {
            return NextResponse.json(
                { error: `Payment exceeds remaining balance. Remaining: ${remaining}` },
                { status: 400 }
            );
        }

        const paymentData: Omit<ApiDebtPayment, 'id'> = {
            debtId,
            amount: Number(amount),
            date: date ? new Date(date) : new Date(),
            note: note || null,
        };

        const paymentId = await createDoc<Omit<ApiDebtPayment, 'id'>>('debt_payments', paymentData);

        // Check if debt is fully paid (alreadyPaid + this payment)
        const totalPaid = alreadyPaid + Number(amount);

        if (totalPaid >= Number(debt.amount)) {
            await updateDoc('debts', debtId, { status: 'paid' });

            // Sync reminders to remove them if paid
            const { syncDebtReminders } = await import("@/lib/reminders");
            await syncDebtReminders(debtId).catch(err => {
                console.error("Failed to sync reminders after debt payment:", err);
            });
        }

        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();

        return NextResponse.json({ id: paymentId, ...paymentData }, { status: 201 });
    } catch (error) {
        console.error("Error creating debt payment:", error);
        return NextResponse.json(
            { error: "Failed to create payment" },
            { status: 500 }
        );
    }
}
