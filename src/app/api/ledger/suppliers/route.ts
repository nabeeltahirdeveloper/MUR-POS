import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger } from "@/types/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
        const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : null;

        if (toDate) {
            toDate.setHours(23, 59, 59, 999);
        }

        // Fetch all relevant data
        const [ledgerEntries, debts, payments] = await Promise.all([
            getAllDocs<FirestoreLedger>('ledger'),
            getAllDocs<any>('debts'),
            getAllDocs<any>('debt_payments')
        ]);

        const supplierMap: Record<string, {
            name: string;
            credit: number;
            debit: number;
            lastEntryDate: Date;
        }> = {};

        const updateSupplier = (name: string, type: 'credit' | 'debit', amount: number, date: any) => {
            if (!name || name === "-") return;

            const entryDate = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));

            // Date Filter
            if (fromDate && entryDate < fromDate) return;
            if (toDate && entryDate > toDate) return;

            const normalizedName = name.trim();
            if (!supplierMap[normalizedName]) {
                supplierMap[normalizedName] = {
                    name: normalizedName,
                    credit: 0,
                    debit: 0,
                    lastEntryDate: new Date(0)
                };
            }

            const supplier = supplierMap[normalizedName];
            if (type === 'credit') {
                supplier.credit += amount;
            } else {
                supplier.debit += amount;
            }

            if (entryDate > supplier.lastEntryDate) {
                supplier.lastEntryDate = entryDate;
            }
        };

        const processedOrders = new Set<string>();

        // 1. Process Ledger entries
        ledgerEntries.forEach(entry => {
            if (!entry.note) return;

            // Extract supplier name from structured note
            const lines = entry.note.split('\n');
            let supplierName = "";
            let remaining: number | null = null;
            let orderNumber = "";

            lines.forEach(line => {
                const trimmed = line.trim();
                const lowerLine = trimmed.toLowerCase();

                if (lowerLine.startsWith("supplier:")) {
                    supplierName = trimmed.substring("supplier:".length).trim();
                } else if (lowerLine.startsWith("remaining:")) {
                    // Try to parse number from "Remaining: X"
                    const val = trimmed.substring("remaining:".length).trim();
                    // Remove "Rs." or commas if present
                    const cleanVal = val.replace(/[^0-9.-]/g, '');
                    remaining = Number(cleanVal);
                } else if (lowerLine.startsWith("order #")) {
                    orderNumber = trimmed.substring("order #".length).trim();
                }
            });

            if (supplierName && entry.type === 'debit') {
                const amount = Number(entry.amount);

                // Check if this entry contains items (is a Bill/Purchase)
                // We check entry.itemId (single item) or if note contains "Item:"
                const hasItems = !!entry.itemId || (entry.note || "").toLowerCase().includes("item:");

                if (remaining !== null && !isNaN(remaining)) {
                    // It's a Bill with explicit Remaining amount
                    updateSupplier(supplierName, 'credit', amount, entry.date); // We owe the full amount

                    const paid = amount - remaining;
                    if (paid > 0) {
                        updateSupplier(supplierName, 'debit', paid, entry.date); // We paid the advance
                    }
                } else {
                    // No "Remaining" field.
                    if (hasItems) {
                        // It has items -> It's a "Cash Purchase" (Fully Paid instantly)
                        // We incurred a Liability (Bill) AND paid it off immediately.
                        updateSupplier(supplierName, 'credit', amount, entry.date); // Bill
                        updateSupplier(supplierName, 'debit', amount, entry.date);  // Payment
                    } else {
                        // No items -> It's a key "Payment" transaction (e.g. giving cash for old debt)
                        updateSupplier(supplierName, 'debit', amount, entry.date); // Payment only
                    }
                }
            }
        });

        // 2. Process Debts
        debts.forEach(debt => {
            // Check if this is a supplier debt (associated with a bill)
            if (debt.note?.includes("Supplier:")) {
                const type = debt.type === 'loaned_in' ? 'credit' : 'debit';
                updateSupplier(debt.personName, type, Number(debt.amount), debt.createdAt);
            }
        });

        // 3. Process Debt Payments
        payments.forEach(payment => {
            const debt = debts.find(d => d.id === payment.debtId);
            if (!debt || !debt.note?.includes("Supplier:")) return;

            const type = debt.type === 'loaned_in' ? 'debit' : 'credit';
            updateSupplier(debt.personName, type, Number(payment.amount), payment.date);
        });

        // Convert map to array and calculate net balance
        const suppliers = Object.values(supplierMap).map(s => ({
            name: s.name,
            balance: s.credit - s.debit,
            lastEntryDate: s.lastEntryDate,
            totalCredit: s.credit,
            totalDebit: s.debit
        })).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());

        return NextResponse.json(suppliers);
    } catch (error) {
        console.error("Error fetching ledger suppliers:", error);
        return NextResponse.json(
            { error: "Failed to fetch ledger suppliers" },
            { status: 500 }
        );
    }
}
