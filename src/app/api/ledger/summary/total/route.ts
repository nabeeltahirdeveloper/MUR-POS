import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { auth } from "@/auth";
import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreDebt, FirestoreDebtPayment, FirestoreUtility } from "@/types/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch all relevant documents
        const [ledgerEntries, debts, debtPayments, utilities] = await Promise.all([
            getAllDocs<FirestoreLedger>('ledger'),
            getAllDocs<FirestoreDebt>('debts'),
            getAllDocs<FirestoreDebtPayment>('debt_payments'),
            getAllDocs<FirestoreUtility>('utilities')
        ]);

        let totalCredit = 0;
        let totalDebit = 0;
        const processedOrderNumbers = new Set<number>();

        // Process Ledger entries - Only count actual cash transactions (paid amounts)
        for (const entry of ledgerEntries) {
            // Skip legacy utility entries to avoid double counting with virtual entries
            if (entry.note && entry.note.startsWith("Utility payment:")) continue;

            // DEDUPLICATION LOGIC:
            // If this entry has an orderNumber, and we've already processed this orderNumber,
            // we should NOT add the advance/payment again (as it's repeated in every entry of the batch).
            const orderNum = entry.orderNumber ? Number(entry.orderNumber) : null;
            if (orderNum && processedOrderNumbers.has(orderNum)) {
                continue;
            }
            if (orderNum) {
                processedOrderNumbers.add(orderNum);
            }

            const totalAmount = Number(entry.amount);

            // Parse actual cash moved from note
            let cashMoved = 0;
            let hasAdvanceOrPayment = false;
            let hasRemaining = false;
            let remainingValue = 0;

            if (entry.note) {
                const lines = entry.note.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();

                    // Robust regex check for Advance or Payment
                    const advMatch = trimmed.match(/^(Advance|Payment):\s*(\d+(\.\d+)?)/i);
                    if (advMatch) {
                        cashMoved = Number(advMatch[2]) || 0;
                        hasAdvanceOrPayment = true;
                        break;
                    }

                    // Robust regex check for Remaining
                    const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                    if (remMatch) {
                        hasRemaining = true;
                        remainingValue = Number(remMatch[1]) || 0;
                    }
                }
            }

            // Fallback
            if (!hasAdvanceOrPayment) {
                if (!hasRemaining || remainingValue === 0) {
                    cashMoved = totalAmount;
                } else {
                    cashMoved = 0;
                }
            }

            // Only count the actual cash moved
            if (entry.type === "credit") {
                totalCredit += cashMoved;
            } else if (entry.type === "debit") {
                totalDebit += cashMoved;
            }
        }

        // Process Debts (Treat New Loans as Cash Flow)
        for (const debt of debts) {
            const amount = Number(debt.amount);
            if (debt.type === 'loaned_in') {
                // We received money (Credit / Cash-In)
                totalCredit += amount;
            } else if (debt.type === 'loaned_out') {
                // We gave money (Debit / Cash-Out)
                totalDebit += amount;
            }
        }

        // Process Debt Payments (Treat Payments as Cash Flow)
        for (const payment of debtPayments) {
            const amount = Number(payment.amount);

            // We need to know the debt type to determine direction
            // Since we fetched all debts, we can find it
            const debt = debts.find(d => d.id === payment.debtId);
            if (debt) {
                if (debt.type === 'loaned_in') {
                    // We are paying back (Debit / Cash-Out)
                    totalDebit += amount;
                } else if (debt.type === 'loaned_out') {
                    // We are receiving back (Credit / Cash-In)
                    totalCredit += amount;
                }
            }
        }

        // Process Paid Utilities (Expenses)
        for (const util of utilities) {
            if (util.status === 'paid') {
                totalDebit += Number(util.amount);
            }
        }

        const net = totalCredit - totalDebit;

        return NextResponse.json({
            summary: {
                totalCredit,
                totalDebit,
                net,
            }
        });
    } catch (error) {
        console.error("Error fetching total summary:", error);
        return NextResponse.json(
            { error: "Failed to fetch total summary" },
            { status: 500 }
        );
    }
}
