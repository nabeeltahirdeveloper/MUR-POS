import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryDocs, getDocById } from "@/lib/prisma-helpers";
import type { ApiLedger, ApiLedgerCategory, ApiCategory, ApiUtility, ApiDebt, ApiDebtPayment } from "@/types/models";

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
        const [entries, paidByDate, allDueThisMonth, debtsThisMonth, paymentsThisMonth] = await Promise.all([
            queryDocs<ApiLedger>('ledger', [
                { field: 'date', operator: '>=', value: startDate },
                { field: 'date', operator: '<=', value: endDate },
            ], {
                orderBy: 'date',
                orderDirection: 'asc',
            }),
            queryDocs<ApiUtility>('utilities', [
                { field: 'paidAt', operator: '>=', value: startDate },
                { field: 'paidAt', operator: '<=', value: endDate },
            ]),
            queryDocs<ApiUtility>('utilities', [
                { field: 'dueDate', operator: '>=', value: startDate },
                { field: 'dueDate', operator: '<=', value: endDate },
            ]),
            queryDocs<ApiDebt>('debts', [
                { field: 'createdAt', operator: '>=', value: startDate },
                { field: 'createdAt', operator: '<=', value: endDate },
            ]),
            queryDocs<ApiDebtPayment>('debt_payments', [
                { field: 'date', operator: '>=', value: startDate },
                { field: 'date', operator: '<=', value: endDate },
            ]),
        ]);

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
                let category: ApiLedgerCategory | ApiCategory | null = null;
                if (entry.categoryId) {
                    category = await getDocById<ApiLedgerCategory>('ledger_categories', entry.categoryId);
                    if (!category) {
                        category = await getDocById<ApiCategory>('categories', entry.categoryId);
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
        const processedOrderNumbers = new Set<number>();
        const categoryBreakdown: Record<string, { name: string; credit: number; debit: number }> = {};
        const dailyBreakdown: Record<string, { date: string; credit: number; debit: number; net: number }> = {};

        // 1. Process Ledger Entries
        for (const entry of entriesWithCategories) {
            // Skip legacy utility entries to avoid double counting with virtual entries
            if (entry.note && entry.note.startsWith("Utility payment:")) continue;

            // DEDUPLICATION
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
                    const advMatch = trimmed.match(/^(Advance|Payment|Paid):\s*(\d+(\.\d+)?)/i);
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

            const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date as any);
            const dateKey = entryDate.toISOString().split("T")[0];

            // Global Totals
            if (entry.type === "credit") {
                totalCredit += currentCash;
            } else {
                totalDebit += currentCash;
            }

            // Category Breakdown
            const catName = entry.category?.name || "Uncategorized";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, credit: 0, debit: 0 };
            }
            if (entry.type === "credit") {
                categoryBreakdown[catName].credit += currentCash;
            } else {
                categoryBreakdown[catName].debit += currentCash;
            }

            // Daily Breakdown
            if (!dailyBreakdown[dateKey]) {
                dailyBreakdown[dateKey] = { date: dateKey, credit: 0, debit: 0, net: 0 };
            }
            if (entry.type === "credit") {
                dailyBreakdown[dateKey].credit += currentCash;
            } else {
                dailyBreakdown[dateKey].debit += currentCash;
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

        // 3. Process New Loans created this month
        for (const debt of debtsThisMonth) {
            const amount = Number(debt.amount);
            const debtDate = debt.createdAt instanceof Date ? debt.createdAt : (debt.createdAt as any).toDate ? (debt.createdAt as any).toDate() : new Date(debt.createdAt);
            const dateKey = debtDate.toISOString().split("T")[0];

            if (debt.type === "loaned_in") {
                totalCredit += amount;
                if (!categoryBreakdown["Loans"]) categoryBreakdown["Loans"] = { name: "Loans", credit: 0, debit: 0 };
                categoryBreakdown["Loans"].credit += amount;
                if (!dailyBreakdown[dateKey]) dailyBreakdown[dateKey] = { date: dateKey, credit: 0, debit: 0, net: 0 };
                dailyBreakdown[dateKey].credit += amount;
            } else {
                totalDebit += amount;
                if (!categoryBreakdown["Loans"]) categoryBreakdown["Loans"] = { name: "Loans", credit: 0, debit: 0 };
                categoryBreakdown["Loans"].debit += amount;
                if (!dailyBreakdown[dateKey]) dailyBreakdown[dateKey] = { date: dateKey, credit: 0, debit: 0, net: 0 };
                dailyBreakdown[dateKey].debit += amount;
            }
        }

        // 4. Process Debt Payments made this month
        // Build debt lookup map for O(1) access
        const debtMap = new Map<string, ApiDebt>();
        for (const d of debtsThisMonth) debtMap.set(d.id, d);
        // Also fetch debts referenced by payments that may have been created in a prior month
        const missingDebtIds = paymentsThisMonth
            .map(p => p.debtId)
            .filter(id => !debtMap.has(id))
            .filter((id, idx, arr) => arr.indexOf(id) === idx);
        const missingDebts = await Promise.all(
            missingDebtIds.map(id => getDocById<ApiDebt>('debts', id))
        );
        for (const d of missingDebts) {
            if (d) debtMap.set(d.id, d);
        }

        for (const payment of paymentsThisMonth) {
            const debt = debtMap.get(payment.debtId);
            if (!debt) continue;
            const amount = Number(payment.amount);
            const payDate = payment.date instanceof Date ? payment.date : (payment.date as any).toDate ? (payment.date as any).toDate() : new Date(payment.date);
            const dateKey = payDate.toISOString().split("T")[0];

            if (debt.type === "loaned_in") {
                totalDebit += amount;
                if (!categoryBreakdown["Loan Payments"]) categoryBreakdown["Loan Payments"] = { name: "Loan Payments", credit: 0, debit: 0 };
                categoryBreakdown["Loan Payments"].debit += amount;
                if (!dailyBreakdown[dateKey]) dailyBreakdown[dateKey] = { date: dateKey, credit: 0, debit: 0, net: 0 };
                dailyBreakdown[dateKey].debit += amount;
            } else {
                totalCredit += amount;
                if (!categoryBreakdown["Loan Payments"]) categoryBreakdown["Loan Payments"] = { name: "Loan Payments", credit: 0, debit: 0 };
                categoryBreakdown["Loan Payments"].credit += amount;
                if (!dailyBreakdown[dateKey]) dailyBreakdown[dateKey] = { date: dateKey, credit: 0, debit: 0, net: 0 };
                dailyBreakdown[dateKey].credit += amount;
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
            { error: `Failed to fetch monthly summary: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}
