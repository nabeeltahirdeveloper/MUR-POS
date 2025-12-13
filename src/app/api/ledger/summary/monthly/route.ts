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
        const yearStr = searchParams.get("year");
        const monthStr = searchParams.get("month"); // 1-12

        if (!yearStr || !monthStr) {
            return NextResponse.json(
                { error: "Year and month are required" },
                { status: 400 }
            );
        }

        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return NextResponse.json(
                { error: "Invalid year or month" },
                { status: 400 }
            );
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month

        // Fetch all entries for the month
        const entries = await prisma.ledger.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                category: true,
            },
            orderBy: {
                date: "asc",
            },
        });

        let totalCredit = 0;
        let totalDebit = 0;
        const categoryBreakdown: Record<string, { name: string; credit: number; debit: number }> = {};
        const dailyBreakdown: Record<string, { date: string; credit: number; debit: number; net: number }> = {};

        for (const entry of entries) {
            const amount = Number(entry.amount);
            const dateKey = entry.date.toISOString().split("T")[0];

            // Global Totals
            if (entry.type === "credit") {
                totalCredit += amount;
            } else {
                totalDebit += amount;
            }

            // Category Breakdown
            const catName = entry.category?.name || "Uncategorized";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }
            if (entry.type === "credit") {
                categoryBreakdown[catName].credit += amount;
            } else {
                categoryBreakdown[catName].debit += amount;
            }

            // Daily Breakdown
            if (!dailyBreakdown[dateKey]) {
                dailyBreakdown[dateKey] = { date: dateKey, credit: 0, debit: 0, net: 0 };
            }
            if (entry.type === "credit") {
                dailyBreakdown[dateKey].credit += amount;
            } else {
                dailyBreakdown[dateKey].debit += amount;
            }
        }

        // Calc nets for daily
        Object.values(dailyBreakdown).forEach((day) => {
            day.net = day.credit - day.debit;
        });

        const net = totalCredit - totalDebit;

        return NextResponse.json({
            year,
            month,
            summary: {
                totalCredit,
                totalDebit,
                net,
            },
            daily: Object.values(dailyBreakdown).sort((a, b) => a.date.localeCompare(b.date)),
            categories: Object.values(categoryBreakdown),
        });
    } catch (error) {
        console.error("Error fetching monthly summary:", error);
        return NextResponse.json(
            { error: "Failed to fetch monthly summary" },
            { status: 500 }
        );
    }
}
