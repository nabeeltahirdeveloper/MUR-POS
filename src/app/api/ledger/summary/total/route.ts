import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { auth } from "@/auth";
import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreDebt, FirestoreDebtPayment, FirestoreUtility } from "@/types/firestore";
import { getOrSetCache } from "@/lib/server-cache";
import { getOrComputeStats } from "@/lib/stats-cache";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await getOrSetCache("ledger:summary:total:v2", 30_000, async () => {
            return getOrComputeStats("ledger_summary_total_v1", 60_000, async () => {
                // Fetch all relevant documents (EXPENSIVE)
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

                    // DEDUPLICATION LOGIC
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

                            const advMatch = trimmed.match(/^(Advance|Payment):\s*(\d+(\.\d+)?)/i);
                            if (advMatch) {
                                cashMoved = Number(advMatch[2]) || 0;
                                hasAdvanceOrPayment = true;
                                break;
                            }

                            const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                            if (remMatch) {
                                hasRemaining = true;
                                remainingValue = Number(remMatch[1]) || 0;
                            }
                        }
                    }

                    // Fallback
                    if (!hasAdvanceOrPayment) {
                        cashMoved = (!hasRemaining || remainingValue === 0) ? totalAmount : 0;
                    }

                    if (entry.type === "credit") totalCredit += cashMoved;
                    else if (entry.type === "debit") totalDebit += cashMoved;
                }

                // Process Debts
                for (const debt of debts) {
                    const amount = Number(debt.amount);
                    if (debt.type === 'loaned_in') totalCredit += amount;
                    else if (debt.type === 'loaned_out') totalDebit += amount;
                }

                // Process Debt Payments
                for (const payment of debtPayments) {
                    const amount = Number(payment.amount);
                    const debt = debts.find(d => d.id === payment.debtId);
                    if (debt?.type === 'loaned_in') totalDebit += amount;
                    else if (debt?.type === 'loaned_out') totalCredit += amount;
                }

                // Process Paid Utilities (Expenses)
                for (const util of utilities) {
                    if (util.status === 'paid') totalDebit += Number(util.amount);
                }

                const net = totalCredit - totalDebit;
                return { summary: { totalCredit, totalDebit, net } };
            });
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching total summary:", error);
        return NextResponse.json(
            { error: "Failed to fetch total summary" },
            { status: 500 }
        );
    }
}
