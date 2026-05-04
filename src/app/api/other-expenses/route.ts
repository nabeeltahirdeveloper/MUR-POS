import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/prisma-helpers";
import type { ApiExpense } from "@/types/models";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { isSystemLocked } from "@/lib/lock";

export const runtime = "nodejs";

export async function GET() {
    try {
        const expenses = await getAllDocs<ApiExpense>('other_expenses', {
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
        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const body = await request.json();
        const { name, amount, dueDate, category, status } = body;

        if (!name || !amount || !dueDate) {
            return NextResponse.json(
                { error: "Name, amount and dueDate are required" },
                { status: 400 }
            );
        }

        const expenseData: Omit<ApiExpense, 'id'> = {
            name,
            amount: Number(amount),
            dueDate: new Date(dueDate),
            category: category || null,
            status: status || 'unpaid',
            createdAt: new Date(),
        };

        const expenseId = await createDoc<Omit<ApiExpense, 'id'>>('other_expenses', expenseData);

        // We can add reminders logic later if needed, mirroring utilities
        // const { syncExpenseReminders } = await import("@/lib/reminders");
        // await syncExpenseReminders(expenseId)...

        invalidateCacheByPrefix("daily-summary:");
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
