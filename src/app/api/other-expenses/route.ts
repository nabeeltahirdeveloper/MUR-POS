import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/firestore-helpers";
import type { FirestoreExpense } from "@/types/firestore";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";

export const runtime = "nodejs";

export async function GET() {
    try {
        const expenses = await getAllDocs<FirestoreExpense>('other_expenses', {
            orderBy: 'dueDate',
            orderDirection: 'asc',
        });

        return NextResponse.json(expenses);
    } catch (error) {
        console.error("Error fetching other expenses:", error);
        return NextResponse.json(
            { error: "Failed to fetch other expenses" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, amount, dueDate, category, status } = body;

        if (!name || !amount || !dueDate) {
            return NextResponse.json(
                { error: "Name, amount and dueDate are required" },
                { status: 400 }
            );
        }

        const expenseData: Omit<FirestoreExpense, 'id'> = {
            name,
            amount: Number(amount),
            dueDate: new Date(dueDate),
            category: category || null,
            status: status || 'unpaid',
            createdAt: new Date(),
        };

        const expenseId = await createDoc<Omit<FirestoreExpense, 'id'>>('other_expenses', expenseData);

        // We can add reminders logic later if needed, mirroring utilities
        // const { syncExpenseReminders } = await import("@/lib/reminders");
        // await syncExpenseReminders(expenseId)...

        triggerDashboardStatsRefresh();

        return NextResponse.json({ id: expenseId, ...expenseData }, { status: 201 });
    } catch (error) {
        console.error("Error creating other expense:", error);
        return NextResponse.json(
            { error: "Failed to create other expense" },
            { status: 500 }
        );
    }
}
