import { NextRequest, NextResponse } from "next/server";
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

        const processedOrders = new Set<string>();

        // Process Ledger entries
        for (const entry of ledgerEntries) {
            // Skip legacy utility entries to avoid double counting with virtual entries
            if (entry.note && entry.note.startsWith("Utility payment:")) continue;

            const amount = Number(entry.amount);
            if (entry.type === "credit") {
                totalCredit += amount;
            } else if (entry.type === "debit") {
                totalDebit += amount;
            }

            // --- Virtual Debit/Credit Logic for Pending Payments ---
            if (entry.note) {
                const lines = entry.note.split('\n');
                let remaining = 0;
                let orderNumber = "";
                // We need names for key generation (customer/supplier) to be consistent with other APIs
                let personName = "";

                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("Remaining:")) {
                        remaining = Number(trimmed.replace("Remaining:", "").trim()) || 0;
                    } else if (trimmed.startsWith("Order #")) {
                        orderNumber = trimmed.replace("Order #", "").trim();
                    } else if (trimmed.includes("Order #")) {
                        const match = trimmed.match(/Order #(\d+)/);
                        if (match) orderNumber = match[1];
                    } else if (trimmed.startsWith("Customer:")) {
                        personName = trimmed.replace("Customer:", "").trim();
                    } else if (trimmed.startsWith("Supplier:")) {
                        personName = trimmed.replace("Supplier:", "").trim();
                    }
                });

                if (remaining > 0) {
                    // Generate key for deduplication (same logic as customer/supplier APIs)

                    // Date Key
                    const dateKey = (entry.date instanceof Date)
                        ? entry.date.toISOString()
                        : (entry.date && typeof entry.date.toDate === 'function')
                            ? entry.date.toDate().toISOString()
                            : String(entry.date);

                    const orderKey = orderNumber
                        ? `${personName}-${orderNumber}`
                        : `${personName}-${dateKey}`;

                    if (!processedOrders.has(orderKey)) {
                        if (entry.type === 'credit') {
                            // Sale with Remaining -> We haven't received this cash yet.
                            // Treat as Virtual Debit to reduce Net Cash-In.
                            totalDebit += remaining;
                        } else if (entry.type === 'debit') {
                            // Purchase with Remaining -> We haven't paid this cash yet.
                            // Treat as Virtual Credit to reduce Net Cash-Out.
                            totalCredit += remaining;
                        }
                        processedOrders.add(orderKey);
                    }
                }
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
