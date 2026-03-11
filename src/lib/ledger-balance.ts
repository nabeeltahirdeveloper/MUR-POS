import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";
import { getOrSetCache } from "@/lib/server-cache";
import { getOrComputeStats } from "@/lib/stats-cache";

export interface PartySummary {
    name: string;
    balance: number;
    lastEntryDate: Date;
    totalCredit: number;
    totalDebit: number;
}

/**
 * Calculates the current balances for all suppliers.
 * Logic synchronized with api/ledger/suppliers/route.ts
 */
/**
 * Calculates the current balances for all suppliers.
 * Balance logic: 
 * - We find all ledger entries for a supplier.
 * - We find the MOST RECENT entry.
 * - If that entry has a "Remaining: X" line, that X is the current total debt.
 * - We also integrate Loans and Payments for a full picture.
 */
export async function getSuppliersSummaries(): Promise<PartySummary[]> {
    return getOrSetCache("ledger-balance:suppliers:v2", 30_000, async () => {
        return getOrComputeStats("ledger_balance_suppliers_v1", 60_000, async () => {
        const [ledgerEntries, debts, payments] = await Promise.all([
            getAllDocs<FirestoreLedger>('ledger'),
            getAllDocs<FirestoreDebt>('debts'),
            getAllDocs<FirestoreDebtPayment>('debt_payments')
        ]);

        const supplierMap: Record<string, {
            name: string;
            totalCredit: number; // What we paid
            totalDebit: number;  // What we bought
            latestRemaining: number;
            lastEntryDate: Date;
            lastRemainingDate: Date;
        }> = {};

    const getPartyData = (name: string) => {
        const normalized = name.trim();
        if (!supplierMap[normalized]) {
            supplierMap[normalized] = {
                name: normalized,
                totalCredit: 0,
                totalDebit: 0,
                latestRemaining: 0,
                lastEntryDate: new Date(0),
                lastRemainingDate: new Date(0)
            };
        }
        return supplierMap[normalized];
    };

    const processedSupplierOrders = new Set<string>();

    // 1. Process Ledger Entries
    ledgerEntries.forEach(entry => {
        if (!entry.note) return;
        const lines = entry.note.split('\n');
        let supplierName = "";
        let remaining: number | null = null;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith("supplier:")) {
                supplierName = trimmed.substring("supplier:".length).trim();
            } else if (trimmed.toLowerCase().includes("remaining:")) {
                const match = trimmed.match(/remaining:\s*(\d+(\.\d+)?)/i);
                if (match) remaining = Number(match[1]) || 0;
            }
        });

        if (supplierName && entry.type === 'debit') {
            const party = getPartyData(supplierName);
            const totalAmount = Number(entry.amount);
            const entryDate = entry.date instanceof Date ? entry.date : (entry.date?.toDate ? entry.date.toDate() : new Date(entry.date));

            // DEDUPLICATION: Track order numbers per business (supplier)
            const orderKey = entry.orderNumber ? `${supplierName}_${entry.orderNumber}` : null;
            const isDuplicateOrder = orderKey && processedSupplierOrders.has(orderKey);

            // Parse actual cash flower from note
            let cashMoved = 0;
            let hasAdvanceOrPayment = false;
            let hasRemainingLabel = false;
            let remainingValueFromNote = 0;
            let hasItems = false;

            lines.forEach(line => {
                const trimmed = line.trim();

                const advMatch = trimmed.match(/^(Advance|Payment|Paid):\s*(\d+(\.\d+)?)/i);
                if (advMatch) {
                    cashMoved = Number(advMatch[2]) || 0;
                    hasAdvanceOrPayment = true;
                }

                const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                if (remMatch) {
                    hasRemainingLabel = true;
                    remainingValueFromNote = Number(remMatch[1]) || 0;
                }

                if (trimmed.toLowerCase().includes("item:")) {
                    hasItems = true;
                }
            });

            // LOGIC FIX:
            // If it has items, it's a purchase. totalAmount is the item price.
            // If it has NO items, it's a payment-only entry. totalAmount is the cash paid.
            
            if (hasItems) {
                // It's a purchase entry
                party.totalCredit += totalAmount; // We owe them more
                if (!isDuplicateOrder) {
                    party.totalDebit += hasAdvanceOrPayment ? cashMoved : 0; // Only add the advance once
                    if (orderKey) processedSupplierOrders.add(orderKey);
                }
            } else {
                // It's a payment-only entry (no items)
                // In payment entries, totalAmount IS the cash moved.
                // We don't add to totalCredit because we didn't buy anything.
                if (!isDuplicateOrder) {
                    party.totalDebit += totalAmount;
                    if (orderKey) processedSupplierOrders.add(orderKey);
                }
            }

            // Use the reported remaining from the LATEST entry as the definitive balance

            // Use the reported remaining from the LATEST entry as the definitive balance
            // Also update last entry date
            if (entryDate > party.lastEntryDate) {
                party.lastEntryDate = entryDate;
            }

            // Update remaining balance from the most recent entry that has a Remaining field
            if (remaining !== null && entryDate > party.lastRemainingDate) {
                party.latestRemaining = remaining;
                party.lastRemainingDate = entryDate;
            }
        }
    });

    // 2. Process Debts & Payments for Suppliers
    debts.forEach(debt => {
        if (debt.note?.toLowerCase().includes("supplier:")) {
            const party = getPartyData(debt.personName);
            const amount = Number(debt.amount);
            const debtDate = debt.createdAt instanceof Date ? debt.createdAt : (debt.createdAt?.toDate ? debt.createdAt.toDate() : new Date(debt.createdAt));

            if (debt.type === 'loaned_in') {
                // We received a loan equivalent to buying on credit
                // This doesn't easily map to "Latest Remaining" if not in ledger, 
                // but we should at least track it in totals.
            }

            if (debtDate > party.lastEntryDate) {
                party.lastEntryDate = debtDate;
            }
        }
    });

    // 3. Finalize
    // For Suppliers: 
    // - totalCredit (Cash-In) = 0 (we don't receive money from suppliers)
    // - totalDebit (Cash-Out) = actual payments made (total amount - remaining)
    // - balance = what we still owe them
        return Object.values(supplierMap).map(s => {
            // Use Computed balance as the absolute truth (Purchases - Payments)
            const computedBalance = s.totalCredit - s.totalDebit;
            const stillOwed = Math.max(0, computedBalance);

            return {
                name: s.name,
                balance: stillOwed,
                lastEntryDate: s.lastEntryDate,
                totalCredit: s.totalCredit,
                totalDebit: s.totalDebit
            };
        }).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());
        });
    });
}

/**
 * Calculates current balances for all customers.
 * Balance logic: 
 * - Identify latest entry for each customer.
 * - Extract "Remaining: X" snapshot.
 */
export async function getCustomersSummaries(): Promise<PartySummary[]> {
    return getOrSetCache("ledger-balance:customers:v2", 30_000, async () => {
        return getOrComputeStats("ledger_balance_customers_v1", 60_000, async () => {
        const [ledgerEntries, debts, payments] = await Promise.all([
            getAllDocs<FirestoreLedger>('ledger'),
            getAllDocs<FirestoreDebt>('debts'),
            getAllDocs<FirestoreDebtPayment>('debt_payments')
        ]);

    const customerMap: Record<string, {
        name: string;
        totalCredit: number; // What they paid us
        totalDebit: number;  // What they bought from us
        latestRemaining: number;
        lastEntryDate: Date;
        lastRemainingDate: Date; // Track when remaining was last updated
    }> = {};

    const getPartyData = (name: string) => {
        const normalized = name.trim();
        if (!customerMap[normalized]) {
            customerMap[normalized] = {
                name: normalized,
                totalCredit: 0,
                totalDebit: 0,
                latestRemaining: 0,
                lastEntryDate: new Date(0),
                lastRemainingDate: new Date(0)
            };
        }
        return customerMap[normalized];
    };

    const processedCustomerOrders = new Set<string>();

    ledgerEntries.forEach(entry => {
        if (!entry.note) return;
        const lines = entry.note.split('\n');
        let customerName = "";
        let remaining: number | null = null;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith("customer:")) {
                customerName = trimmed.substring("customer:".length).trim();
            } else if (trimmed.toLowerCase().includes("remaining:")) {
                const match = trimmed.match(/remaining:\s*(\d+(\.\d+)?)/i);
                if (match) remaining = Number(match[1]) || 0;
            }
        });

        if (customerName && entry.type === 'credit') {
            const party = getPartyData(customerName);
            const totalAmount = Number(entry.amount);
            const entryDate = entry.date instanceof Date ? entry.date : (entry.date?.toDate ? entry.date.toDate() : new Date(entry.date));

            // DEDUPLICATION
            const orderKey = entry.orderNumber ? `${customerName}_${entry.orderNumber}` : null;
            const isDuplicateOrder = orderKey && processedCustomerOrders.has(orderKey);

            // Parse actual cash flower from note
            let cashMoved = 0;
            let hasAdvanceOrPayment = false;
            let hasRemainingLabel = false;
            let remainingValueFromNote = 0;
            let hasItems = false;

            lines.forEach(line => {
                const trimmed = line.trim();

                const advMatch = trimmed.match(/^(Advance|Payment|Paid):\s*(\d+(\.\d+)?)/i);
                if (advMatch) {
                    cashMoved = Number(advMatch[2]) || 0;
                    hasAdvanceOrPayment = true;
                }

                const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                if (remMatch) {
                    hasRemainingLabel = true;
                    remainingValueFromNote = Number(remMatch[1]) || 0;
                }
                
                if (trimmed.toLowerCase().includes("item:")) {
                    hasItems = true;
                }
            });

            if (hasItems) {
                // It's a sale
                party.totalDebit += totalAmount; // They owe us more
                if (!isDuplicateOrder) {
                    party.totalCredit += hasAdvanceOrPayment ? cashMoved : 0; // They paid us this much now
                    if (orderKey) processedCustomerOrders.add(orderKey);
                }
            } else {
                // It's a payment-only entry
                if (!isDuplicateOrder) {
                    party.totalCredit += totalAmount;
                    if (orderKey) processedCustomerOrders.add(orderKey);
                }
            }

            // Update last entry date
            if (entryDate > party.lastEntryDate) {
                party.lastEntryDate = entryDate;
            }

            // Update remaining balance from the most recent entry that has a Remaining field
            // Track this separately so we don't lose the balance if newer entries don't have it
            if (remaining !== null && entryDate > party.lastRemainingDate) {
                party.latestRemaining = remaining;
                party.lastRemainingDate = entryDate;
            }
        }
    });

    const result = Object.values(customerMap).map(c => {
        // Use Computed balance as the absolute truth (Sales - Payments)
        const computedBalance = c.totalDebit - c.totalCredit;
        const stillOwed = Math.max(0, computedBalance);

        return {
            name: c.name,
            balance: stillOwed,
            lastEntryDate: c.lastEntryDate,
            totalCredit: c.totalCredit,
            totalDebit: c.totalDebit
        };
    }).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());

        return result;
        });
    });
}

export async function getSupplierBalance(name: string): Promise<number> {
    // normalize the incoming name to avoid mismatches due to spacing/case
    const normalizedName = name.trim().toLowerCase();
    const summaries = await getSuppliersSummaries();
    const summary = summaries.find(
        s => s.name.trim().toLowerCase() === normalizedName
    );
    return summary ? summary.balance : 0;
}

export async function getCustomerBalance(name: string): Promise<number> {
    const normalizedName = name.trim().toLowerCase();
    const summaries = await getCustomersSummaries();
    const summary = summaries.find(
        s => s.name.trim().toLowerCase() === normalizedName
    );
    return summary ? summary.balance : 0;
}
