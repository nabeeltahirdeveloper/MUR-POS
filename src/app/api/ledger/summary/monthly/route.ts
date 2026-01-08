import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Timestamp } from "@/lib/firestore";
import { queryDocs, getDocById } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreCategory, FirestoreUtility } from "@/types/firestore";

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
        // Hybrid query for Utilities:
        // 1. Get items physically paid this month (Cash Basis - New Data) - Single Field Index
        // 2. Get items due this month that are paid (Fallback for Legacy Data) - Composite Index matching current schema
        const results = await Promise.all([
            queryDocs<FirestoreLedger>('ledger', [
                { field: 'date', operator: '>=', value: Timestamp.fromDate(startDate) },
                { field: 'date', operator: '<=', value: Timestamp.fromDate(endDate) },
            ], {
                orderBy: 'date',
                orderDirection: 'asc',
            }),
            queryDocs<FirestoreUtility>('utilities', [
                { field: 'paidAt', operator: '>=', value: Timestamp.fromDate(startDate) },
                { field: 'paidAt', operator: '<=', value: Timestamp.fromDate(endDate) },
            ]),
            queryDocs<FirestoreUtility>('utilities', [
                { field: 'dueDate', operator: '>=', value: Timestamp.fromDate(startDate) },
                { field: 'dueDate', operator: '<=', value: Timestamp.fromDate(endDate) },
            ])
        ]);

        // Fixed syntax
        const [entries, paidByDate, allDueThisMonth] = [
            results[0] as FirestoreLedger[],
            results[1] as FirestoreUtility[],
            results[2] as FirestoreUtility[]
        ];

        // Filter legacy in memory
        const paidByDue = allDueThisMonth.filter(u => u.status === 'paid');

        // Merge utilities: prefer paidByDate
        const paidUtilities = [...paidByDate];
        const seenIds = new Set(paidByDate.map(u => u.id));

        for (const u of paidByDue) {
            if (!u.paidAt && !seenIds.has(u.id)) {
                paidUtilities.push(u);
            }
        }

        // Fetch categories for entries
        const entriesWithCategories = await Promise.all(
            entries.map(async (entry) => {
                let category: FirestoreLedgerCategory | FirestoreCategory | null = null;
                if (entry.categoryId) {
                    category = await getDocById<FirestoreLedgerCategory>('ledger_categories', entry.categoryId);
                    if (!category) {
                        category = await getDocById<FirestoreCategory>('categories', entry.categoryId);
                    }
                }
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

        // 1. Process Ledger Entries
        for (const entry of entriesWithCategories) {
            // Skip legacy utility entries to avoid double counting with virtual entries
            if (entry.note && entry.note.startsWith("Utility payment:")) continue;

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

        // 2. Process Paid Utilities
        for (const util of paidUtilities) {
            const amount = Number(util.amount);
            // Use paidAt if available, otherwise fallback to dueDate
            const dateSource = util.paidAt || util.dueDate;
            const entryDate = dateSource instanceof Date ? dateSource : (dateSource as any).toDate ? (dateSource as any).toDate() : new Date(dateSource);
            const dateKey = entryDate.toISOString().split("T")[0];

            // Global Totals (Utilities are expenses/debit)
            totalDebit += amount;

            // Category Breakdown
            const catName = util.category || "Utility";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }
            categoryBreakdown[catName].debit += amount;

            // Daily Breakdown
            if (!dailyBreakdown[dateKey]) {
                dailyBreakdown[dateKey] = { date: dateKey, credit: 0, debit: 0, net: 0 };
            }
            dailyBreakdown[dateKey].debit += amount;
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
            { error: `Failed to fetch monthly summary: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}
