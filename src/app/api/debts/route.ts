import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/firestore-helpers";
import type { FirestoreDebt } from "@/types/firestore";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";

export const runtime = "nodejs";

export async function GET() {
    try {
        const debts = await getAllDocs<FirestoreDebt>('debts', {
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });

        return NextResponse.json(debts);
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
