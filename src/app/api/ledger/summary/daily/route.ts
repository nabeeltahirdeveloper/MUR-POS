import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get("date");

        if (!dateStr) {
            return NextResponse.json(
                { error: "Date parameter is required (YYYY-MM-DD)" },
                { status: 400 }
            );
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        // Since date is @db.Date, we can query by the exact date object in theory,
        // but Prisma usually treats Date objects as timestamps. 
        // However, for @db.Date columns, passing a Date object usually matches that day.
        // To be safe and precise with Prisma's DateTime handling:
        // We'll trust that passing the Date object matches the @db.Date column correctly
        // or use a range if needed. But usually `equals` works for Date types if the time is 00:00:00.

        // Let's grab all entries for that date first to be safe and simple
        // Or closer:
        const startOfDay = new Date(dateStr);
        startOfDay.setHours(0, 0, 0, 0);

        // Actually, with @db.Date, storing 2023-01-01 usually means 00:00:00 UTC.
        // If we just match `date: new Date(dateStr)` it should work.

        const entries = await prisma.ledger.findMany({
            where: {
                date: new Date(dateStr),
            },
            include: {
                category: true,
            },
        });

        // Calculate totals in JS
        let totalCredit = 0;
        let totalDebit = 0;
        const categoryBreakdown: Record<string, { name: string; credit: number; debit: number }> = {};

        for (const entry of entries) {
            const amount = Number(entry.amount);
            if (entry.type === "credit") {
                totalCredit += amount;
            } else {
                totalDebit += amount;
            }

            const catName = entry.category?.name || "Uncategorized";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }

            if (entry.type === "credit") {
                categoryBreakdown[catName].credit += amount;
            } else {
                categoryBreakdown[catName].debit += amount;
            }
        }

        const net = totalCredit - totalDebit;

        return NextResponse.json({
            date: dateStr,
            summary: {
                totalCredit,
                totalDebit,
                net,
            },
            breakdown: Object.values(categoryBreakdown),
        });
    } catch (error) {
        console.error("Error fetching daily summary:", error);
        return NextResponse.json(
            { error: "Failed to fetch daily summary" },
            { status: 500 }
        );
    }
}
