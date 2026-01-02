import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch all relevant documents
        const [ledgerEntries, debts, debtPayments] = await Promise.all([
            getAllDocs<FirestoreLedger>('ledger'),
            getAllDocs<FirestoreDebt>('debts'),
            getAllDocs<FirestoreDebtPayment>('debt_payments')
        ]);

        let totalCredit = 0;
        let totalDebit = 0;

        // Process Ledger entries
        for (const entry of ledgerEntries) {
            const amount = Number(entry.amount);
            if (entry.type === "credit") {
                totalCredit += amount;
            } else if (entry.type === "debit") {
                totalDebit += amount;
            }
        }

        // Process Debts (Active Loan-In and Loan-Out)
        // Loan-In: Money taken, increases business cash balance
        // Loan-Out: Money given, decreases business cash balance
        for (const debt of debts) {
            const debtAmount = Number(debt.amount);

            // Calculate total payments for this specific debt
            const totalPaid = debtPayments
                .filter(p => p.debtId === debt.id)
                .reduce((sum, p) => sum + Number(p.amount), 0);

            const remaining = Math.max(0, debtAmount - totalPaid);

            if (remaining > 0) {
                if (debt.type === 'loaned_in') {
                    // Money we have but owe back
                    totalCredit += remaining;
                } else if (debt.type === 'loaned_out') {
                    // Money we gave out and are waiting for
                    totalDebit += remaining;
                }
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
