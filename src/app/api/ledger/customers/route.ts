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

        const { searchParams } = new URL(req.url);
        const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
        const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : null;

        console.log(`[DEBUG] Customer Balance Calc: Range ${fromDate} - ${toDate}`);

        if (toDate) {
            // Set to end of day
            toDate.setHours(23, 59, 59, 999);
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

            const entryDate = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));

            // Date Filtering Logic
            if (fromDate && entryDate < fromDate) return;
            if (toDate && entryDate > toDate) return;

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

            if (entryDate > customer.lastEntryDate) {
                customer.lastEntryDate = entryDate;
            }
        };

        const processedOrders = new Set<string>();

        // 1. Process Ledger entries
        ledgerEntries.forEach(entry => {
            if (!entry.note) return;

            // Extract customer name from structured note
            const lines = entry.note.split('\n');
            let customerName = "";
            let remaining = 0;
            let orderNumber = "";

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith("Customer:")) {
                    customerName = trimmed.replace("Customer:", "").trim();
                } else if (trimmed.startsWith("Remaining:")) {
                    // Flexible parsing: handles "Remaining: 300" and "Remaining:300"
                    remaining = Number(trimmed.replace("Remaining:", "").trim()) || 0;
                } else if (trimmed.startsWith("Order #")) {
                    orderNumber = trimmed.replace("Order #", "").trim();
                } else if (trimmed.includes("Order #")) {
                    // Fallback if Order # is somewhere else or formatted differently
                    const match = trimmed.match(/Order #(\d+)/);
                    if (match) orderNumber = match[1];
                }
            });

            if (customerName) {
                // Always add the item amount (Sales)
                updateCustomer(customerName, entry.type, Number(entry.amount), entry.date);

                // Apply Virtual Debit for Remaining Balance
                // Logic: Balance = Total Sales (Credit) - Remaining (Debit) = Cash Received
                // Constraint: Only apply ONCE per Order to avoid double counting if bill has multiple items.
                if (remaining > 0 && entry.type === 'credit') {
                    // Use a unique key for the order logic. 
                    // If orderNumber is present, use it.
                    // If NOT present, use the Entry Date (which is identical for all items in a single batch transaction).

                    // IMPORTANT: Use entry.date (which effectively comes from Firestore timestamp) as key.
                    // Firestore timestamps might need conversion to string for consistent key.
                    // entry.date is likely a Date object or Timestamp object from Firestore helpers.

                    const dateKey = (entry.date instanceof Date)
                        ? entry.date.toISOString()
                        : (entry.date && typeof entry.date.toDate === 'function')
                            ? entry.date.toDate().toISOString()
                            : String(entry.date);

                    const orderKey = orderNumber
                        ? `${customerName}-${orderNumber}`
                        : `${customerName}-${dateKey}`;

                    if (!processedOrders.has(orderKey)) {
                        console.log(`[DEBUG] Applying Virtual Debit: Name=${customerName}, Debit=${remaining}, Key=${orderKey}`);
                        updateCustomer(customerName, 'debit', remaining, entry.date);
                        processedOrders.add(orderKey);
                    }
                }
            }
        });

        // 2. Process Debts
        debts.forEach(debt => {
            // Skip debts meant for suppliers
            if (debt.note?.includes("Supplier:")) return;

            const type = debt.type === 'loaned_in' ? 'credit' : 'debit';
            updateCustomer(debt.personName, type, Number(debt.amount), debt.createdAt);
        });

        // 3. Process Debt Payments
        payments.forEach(payment => {
            const debt = debts.find(d => d.id === payment.debtId);
            if (!debt || debt.note?.includes("Supplier:")) return;

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
