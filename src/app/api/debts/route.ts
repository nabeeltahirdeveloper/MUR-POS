import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/prisma-helpers";
import type { FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { isSystemLocked } from "@/lib/lock";

export const runtime = "nodejs";

export async function GET() {
    try {
        const [debts, allPayments] = await Promise.all([
            getAllDocs<FirestoreDebt>('debts', {
                orderBy: 'createdAt',
                orderDirection: 'desc',
            }),
            getAllDocs<FirestoreDebtPayment>('debt_payments'),
        ]);

        // Group payments by debtId for O(1) lookup
        const paymentsByDebt: Record<string, number> = {};
        for (const p of allPayments) {
            paymentsByDebt[p.debtId] = (paymentsByDebt[p.debtId] || 0) + Number(p.amount);
        }

        // Enrich debts with totalPaid and remaining
        const enriched = debts.map(d => ({
            ...d,
            totalPaid: paymentsByDebt[d.id] || 0,
            remaining: Math.max(0, Number(d.amount) - (paymentsByDebt[d.id] || 0)),
        }));

        return NextResponse.json(enriched);
    } catch (error) {
        console.error("Error fetching debts:", error);
        return NextResponse.json(
            { error: "Failed to fetch debts" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const body = await request.json();
        const { personName, type, amount, dueDate, note } = body;

        if (!personName || !type || !amount) {
            return NextResponse.json(
                { error: "Person name, type and amount are required" },
                { status: 400 }
            );
        }

        const debtData: Omit<FirestoreDebt, 'id'> = {
            personName,
            type,
            amount: Number(amount),
            dueDate: dueDate ? new Date(dueDate) : null,
            note: note || null,
            status: 'active',
            createdAt: new Date(),
        };

        const debtId = await createDoc<Omit<FirestoreDebt, 'id'>>('debts', debtData);

        // Sync reminders if due date is provided
        if (debtData.dueDate) {
            const { syncDebtReminders } = await import("@/lib/reminders");
            await syncDebtReminders(debtId).catch(err => {
                console.error("Failed to sync reminders for new debt:", err);
            });
        }

        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();

        return NextResponse.json({ id: debtId, ...debtData }, { status: 201 });
    } catch (error) {
        console.error("Error creating debt:", error);
        return NextResponse.json(
            { error: "Failed to create debt" },
            { status: 500 }
        );
    }
}
