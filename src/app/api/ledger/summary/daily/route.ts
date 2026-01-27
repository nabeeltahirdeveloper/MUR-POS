import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { auth } from "@/auth";
import { db, Timestamp } from "@/lib/firestore";
import { queryDocs, getDocById } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreLedgerCategory, FirestoreCategory, FirestoreDebt, FirestoreDebtPayment, FirestoreUtility } from "@/types/firestore";

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
        const results = await Promise.all([
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
            ]),
            // Hybrid query for Utilities to handle new (paidAt) and legacy (dueDate) data
            queryDocs<FirestoreUtility>('utilities', [
                { field: 'paidAt', operator: '>=', value: Timestamp.fromDate(startOfDay) },
                { field: 'paidAt', operator: '<=', value: Timestamp.fromDate(endOfDay) },
            ]),
            // Fallback for Legacy Data
            // Fallback for Legacy Data - Query by date only to avoid composite index, then filter in memory
            queryDocs<FirestoreUtility>('utilities', [
                { field: 'dueDate', operator: '>=', value: Timestamp.fromDate(startOfDay) },
                { field: 'dueDate', operator: '<=', value: Timestamp.fromDate(endOfDay) },
            ]),
        ]);

        // Fixed syntax
        const [entries, newDebts, todayPayments, paidByDate, allDueToday] = [
            results[0] as FirestoreLedger[],
            results[1] as FirestoreDebt[],
            results[2] as FirestoreDebtPayment[],
            results[3] as FirestoreUtility[],
            results[4] as FirestoreUtility[]
        ];

        // Filter legacy internally to avoid index error
        const paidByDue = allDueToday.filter(u => u.status === 'paid');

        // Merge utilities: prefer paidByDate. Use paidByDue only if paidAt is missing (legacy).
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
                return { ...entry, category };
            })
        );

        // Calculate totals
        let totalCredit = 0;
        let totalDebit = 0;
        const processedOrderNumbers = new Set<number>();
        const categoryBreakdown: Record<string, { name: string; credit: number; debit: number }> = {};

        // 1. Process Ledger entries
        for (const entry of entriesWithCategories) {
            // Skip legacy utility entries to avoid double counting with virtual entries
            if (entry.note && entry.note.startsWith("Utility payment:")) continue;

            // DEDUPLICATION LOGIC
            const orderNum = entry.orderNumber ? Number(entry.orderNumber) : null;
            const isDuplicateOrder = orderNum && processedOrderNumbers.has(orderNum);

            const totalAmount = Number(entry.amount);

            // Parse actual cash moved from note
            let cashMoved = 0;
            let hasAdvanceOrPayment = false;
            let hasRemainingLabel = false;
            let remainingValueFromNote = 0;

            if (entry.note) {
                const lines = entry.note.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();

                    // Robust regex check
                    const advMatch = trimmed.match(/^(Advance|Payment):\s*(\d+(\.\d+)?)/i);
                    if (advMatch) {
                        cashMoved = Number(advMatch[2]) || 0;
                        hasAdvanceOrPayment = true;
                        break;
                    }

                    const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                    if (remMatch) {
                        hasRemainingLabel = true;
                        remainingValueFromNote = Number(remMatch[1]) || 0;
                    }
                }
            }

            // Fallback
            if (!hasAdvanceOrPayment) {
                if (!hasRemainingLabel || remainingValueFromNote === 0) {
                    cashMoved = totalAmount;
                } else {
                    cashMoved = 0;
                }
            }

            const currentCash = isDuplicateOrder ? 0 : cashMoved;
            if (orderNum && !isDuplicateOrder) {
                processedOrderNumbers.add(orderNum);
            }

            if (entry.type === "credit") {
                totalCredit += currentCash;
            } else {
                totalDebit += currentCash;
            }

            const catName = entry.category?.name || "Uncategorized";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }

            if (entry.type === "credit") {
                categoryBreakdown[catName].credit += currentCash;
            } else {
                categoryBreakdown[catName].debit += currentCash;
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

        // 4. Process Paid Utilities paid today
        for (const util of paidUtilities) {
            const amount = Number(util.amount);
            const catName = util.category || "Utility";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }
            // Utilities are expenses (debit)
            totalDebit += amount;
            categoryBreakdown[catName].debit += amount;
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
            { error: `Failed to fetch daily summary: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}
