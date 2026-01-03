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

        // Fetch all relevant data
        const [ledgerEntries, debts, payments] = await Promise.all([
            getAllDocs<FirestoreLedger>('ledger'),
            getAllDocs<FirestoreDebt>('debts'),
            getAllDocs<FirestoreDebtPayment>('debt_payments')
        ]);

        const customerMap: Record<string, {
            name: string;
            credit: number;
            debit: number;
            lastEntryDate: Date;
        }> = {};

        const updateCustomer = (name: string, type: 'credit' | 'debit', amount: number, date: any) => {
            if (!name || name === "-") return;

            const normalizedName = name.trim();
            if (!customerMap[normalizedName]) {
                customerMap[normalizedName] = {
                    name: normalizedName,
                    credit: 0,
                    debit: 0,
                    lastEntryDate: new Date(0)
                };
            }

            const customer = customerMap[normalizedName];
            if (type === 'credit') {
                customer.credit += amount;
            } else {
                customer.debit += amount;
            }

            const entryDate = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
            if (entryDate > customer.lastEntryDate) {
                customer.lastEntryDate = entryDate;
            }
        };

        // 1. Process Ledger entries
        ledgerEntries.forEach(entry => {
            if (!entry.note) return;

            // Extract customer name from structured note
            const lines = entry.note.split('\n');
            let customerName = "";
            lines.forEach(line => {
                if (line.startsWith("Customer: ")) {
                    customerName = line.replace("Customer: ", "").trim();
                }
            });

            if (customerName) {
                updateCustomer(customerName, entry.type, Number(entry.amount), entry.date);
            }
        });

        // 2. Process Debts
        debts.forEach(debt => {
            const type = debt.type === 'loaned_in' ? 'credit' : 'debit';
            updateCustomer(debt.personName, type, Number(debt.amount), debt.createdAt);
        });

        // 3. Process Debt Payments
        payments.forEach(payment => {
            const debt = debts.find(d => d.id === payment.debtId);
            if (!debt) return;

            const type = debt.type === 'loaned_in' ? 'debit' : 'credit';
            updateCustomer(debt.personName, type, Number(payment.amount), payment.date);
        });

        // Convert map to array and calculate net balance
        const customers = Object.values(customerMap).map(c => ({
            name: c.name,
            balance: c.credit - c.debit,
            lastEntryDate: c.lastEntryDate,
            totalCredit: c.credit,
            totalDebit: c.debit
        })).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());

        return NextResponse.json(customers);
    } catch (error) {
        console.error("Error fetching ledger customers:", error);
        return NextResponse.json(
            { error: "Failed to fetch ledger customers" },
            { status: 500 }
        );
    }
}
