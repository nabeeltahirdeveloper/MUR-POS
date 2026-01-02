import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, Timestamp } from "@/lib/firestore";
import { queryDocs, getDocById } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreCategory, FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";

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

        const startOfDay = new Date(dateStr);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateStr);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch everything relevant for today
        const [entries, newDebts, todayPayments] = await Promise.all([
            queryDocs<FirestoreLedger>('ledger', [
                { field: 'date', operator: '>=', value: Timestamp.fromDate(startOfDay) },
                { field: 'date', operator: '<=', value: Timestamp.fromDate(endOfDay) },
            ]),
            queryDocs<FirestoreDebt>('debts', [
                { field: 'createdAt', operator: '>=', value: Timestamp.fromDate(startOfDay) },
                { field: 'createdAt', operator: '<=', value: Timestamp.fromDate(endOfDay) },
            ]),
            queryDocs<FirestoreDebtPayment>('debt_payments', [
                { field: 'date', operator: '>=', value: Timestamp.fromDate(startOfDay) },
                { field: 'date', operator: '<=', value: Timestamp.fromDate(endOfDay) },
            ])
        ]);

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
                return { ...entry, category };
            })
        );

        // Calculate totals
        let totalCredit = 0;
        let totalDebit = 0;
        const categoryBreakdown: Record<string, { name: string; credit: number; debit: number }> = {};

        // 1. Process Ledger entries
        for (const entry of entriesWithCategories) {
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

        // 2. Process New Loans created today
        for (const debt of newDebts) {
            const amount = Number(debt.amount);
            const catName = "Loans";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }

            if (debt.type === 'loaned_in') {
                totalCredit += amount;
                categoryBreakdown[catName].credit += amount;
            } else {
                totalDebit += amount;
                categoryBreakdown[catName].debit += amount;
            }
        }

        // 3. Process Debt Payments made today
        for (const payment of todayPayments) {
            const debt = await getDocById<FirestoreDebt>('debts', payment.debtId);
            if (!debt) continue;

            const amount = Number(payment.amount);
            const catName = "Loan Payments";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }

            if (debt.type === 'loaned_in') {
                totalDebit += amount;
                categoryBreakdown[catName].debit += amount;
            } else {
                totalCredit += amount;
                categoryBreakdown[catName].credit += amount;
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
