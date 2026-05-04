import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/prisma-helpers";
import type { ApiUtility } from "@/types/models";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { isSystemLocked } from "@/lib/lock";

export const runtime = "nodejs";

export async function GET() {
    try {
        const utilities = await getAllDocs<ApiUtility>('utilities', {
            orderBy: 'dueDate',
            orderDirection: 'asc',
        });

        return NextResponse.json(utilities);
    } catch (error) {
        console.error("Error fetching utilities:", error);
        return NextResponse.json(
            { error: "Failed to fetch utilities" },
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

        const utilityData: Omit<ApiUtility, 'id'> = {
            name,
            amount: Number(amount),
            dueDate: new Date(dueDate),
            category: category || null,
            status: status || 'unpaid',
            createdAt: new Date(),
        };

        const utilityId = await createDoc<Omit<ApiUtility, 'id'>>('utilities', utilityData);

        // Sync reminders immediately if due date is close
        const { syncUtilityReminders } = await import("@/lib/reminders");
        await syncUtilityReminders(utilityId).catch(err => {
            console.error("Failed to sync reminders for new utility:", err);
        });

        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();

        return NextResponse.json({ id: utilityId, ...utilityData }, { status: 201 });
    } catch (error) {
        console.error("Error creating utility:", error);
        return NextResponse.json(
            { error: "Failed to create utility" },
            { status: 500 }
        );
    }
}
