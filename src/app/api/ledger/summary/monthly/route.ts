import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Timestamp } from "@/lib/firestore";
import { queryDocs, getDocById } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory } from "@/types/firestore";

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
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, month, 0); // Last day of month
        endDate.setHours(23, 59, 59, 999);

        // Fetch all entries for the month
        const entries = await queryDocs<FirestoreLedger>('ledger', [
            { field: 'date', operator: '>=', value: Timestamp.fromDate(startDate) },
            { field: 'date', operator: '<=', value: Timestamp.fromDate(endDate) },
        ], {
            orderBy: 'date',
            orderDirection: 'asc',
        });

        // Fetch categories for entries
        const entriesWithCategories = await Promise.all(
            entries.map(async (entry) => {
                const category = entry.categoryId 
                    ? await getDocById<FirestoreLedgerCategory>('ledger_categories', entry.categoryId)
                    : null;
                return {
                    ...entry,
                    category,
                };
            })
        );

        let totalCredit = 0;
        let totalDebit = 0;
        const categoryBreakdown: Record<string, { name: string; credit: number; debit: number }> = {};
        const dailyBreakdown: Record<string, { date: string; credit: number; debit: number; net: number }> = {};

        for (const entry of entriesWithCategories) {
            const amount = Number(entry.amount);
            // Convert Firestore Timestamp to Date if needed
            const entryDate = entry.date instanceof Date ? entry.date : (entry.date as any).toDate ? (entry.date as any).toDate() : new Date(entry.date);
            const dateKey = entryDate.toISOString().split("T")[0];

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
