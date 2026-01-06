import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/firestore-helpers";
import type { FirestoreUtility } from "@/types/firestore";

export const runtime = "nodejs";

export async function GET() {
    try {
        const utilities = await getAllDocs<FirestoreUtility>('utilities', {
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
        const body = await request.json();
        const { name, amount, dueDate, category, status } = body;

        if (!name || !amount || !dueDate) {
            return NextResponse.json(
                { error: "Name, amount and dueDate are required" },
                { status: 400 }
            );
        }

        const utilityData: Omit<FirestoreUtility, 'id'> = {
            name,
            amount: Number(amount),
            dueDate: new Date(dueDate),
            category: category || null,
            status: status || 'unpaid',
            createdAt: new Date(),
        };

        const utilityId = await createDoc<Omit<FirestoreUtility, 'id'>>('utilities', utilityData);

        // Sync reminders immediately if due date is close
        const { syncUtilityReminders } = await import("@/lib/reminders");
        await syncUtilityReminders(utilityId).catch(err => {
            console.error("Failed to sync reminders for new utility:", err);
        });

        return NextResponse.json({ id: utilityId, ...utilityData }, { status: 201 });
    } catch (error) {
        console.error("Error creating utility:", error);
        return NextResponse.json(
            { error: "Failed to create utility" },
            { status: 500 }
        );
    }
}
