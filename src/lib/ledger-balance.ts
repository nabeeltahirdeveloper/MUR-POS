import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger, FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";

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
    }> = {};

    const getPartyData = (name: string) => {
        const normalized = name.trim();
        if (!supplierMap[normalized]) {
            supplierMap[normalized] = {
                name: normalized,
                totalCredit: 0,
                totalDebit: 0,
                latestRemaining: 0,
                lastEntryDate: new Date(0)
            };
        }
        return supplierMap[normalized];
    };

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

            // Parse actual cash flower from note
            let cashMoved = 0;
            let hasAdvanceOrPayment = false;
            let hasRemainingLabel = false;
            let remainingValueFromNote = 0;

            lines.forEach(line => {
                const trimmed = line.trim();

                // Robust regex check
                const advMatch = trimmed.match(/^(Advance|Payment):\s*(\d+(\.\d+)?)/i);
                if (advMatch) {
                    cashMoved = Number(advMatch[2]) || 0;
                    hasAdvanceOrPayment = true;
                }

                const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                if (remMatch) {
                    hasRemainingLabel = true;
                    remainingValueFromNote = Number(remMatch[1]) || 0;
                }
            });

            // Fallback: If no label, check if fully paid
            if (!hasAdvanceOrPayment) {
                if (!hasRemainingLabel || remainingValueFromNote === 0) {
                    cashMoved = totalAmount;
                } else {
                    cashMoved = 0;
                }
            }

            // We track "totalPurchase" (internal name totalCredit in this structure) 
            // and the "actualPaid" sum separately? 
            // Actually let's use the same logic as elsewhere for consistency.
            // We want totalCredit to be the SUM of all BILL amounts? 
            // The original code used totalCredit (internal) as total Purchase amount.
            party.totalCredit += totalAmount;
            party.totalDebit += cashMoved;

            // Use the reported remaining from the LATEST entry as the definitive balance
            if (entryDate > party.lastEntryDate) {
                party.lastEntryDate = entryDate;
                if (remaining !== null) {
                    party.latestRemaining = remaining;
                }
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
        const stillOwed = s.latestRemaining;
        const actualPaid = s.totalDebit;

        return {
            name: s.name,
            balance: stillOwed,
            lastEntryDate: s.lastEntryDate,
            totalCredit: 0,
            totalDebit: actualPaid
        };
    }).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());
}

/**
 * Calculates current balances for all customers.
 * Balance logic: 
 * - Identify latest entry for each customer.
 * - Extract "Remaining: X" snapshot.
 */
export async function getCustomersSummaries(): Promise<PartySummary[]> {
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
    }> = {};

    const getPartyData = (name: string) => {
        const normalized = name.trim();
        if (!customerMap[normalized]) {
            customerMap[normalized] = {
                name: normalized,
                totalCredit: 0,
                totalDebit: 0,
                latestRemaining: 0,
                lastEntryDate: new Date(0)
            };
        }
        return customerMap[normalized];
    };

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

            // Parse actual cash flower from note
            let cashMoved = 0;
            let hasAdvanceOrPayment = false;
            let hasRemainingLabel = false;
            let remainingValueFromNote = 0;

            lines.forEach(line => {
                const trimmed = line.trim();

                // Robust regex check
                const advMatch = trimmed.match(/^(Advance|Payment):\s*(\d+(\.\d+)?)/i);
                if (advMatch) {
                    cashMoved = Number(advMatch[2]) || 0;
                    hasAdvanceOrPayment = true;
                }

                const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                if (remMatch) {
                    hasRemainingLabel = true;
                    remainingValueFromNote = Number(remMatch[1]) || 0;
                }
            });

            // Fallback
            if (!hasAdvanceOrPayment) {
                if (!hasRemainingLabel || remainingValueFromNote === 0) {
                    cashMoved = totalAmount;
                } else {
                    cashMoved = 0;
                }
            }

            party.totalCredit += cashMoved; // Total Paid (Cash-In for customers)

            if (entryDate > party.lastEntryDate) {
                party.lastEntryDate = entryDate;
                if (remaining !== null) {
                    party.latestRemaining = remaining;
                }
            }
        }
    });

    return Object.values(customerMap).map(c => {
        const stillOwed = c.latestRemaining; // Cumulative balance
        const actualReceived = c.totalCredit; // Total actual cash received

        return {
            name: c.name,
            balance: stillOwed,
            lastEntryDate: c.lastEntryDate,
            totalCredit: actualReceived, // Total Cash-In
            totalDebit: 0
        };
    }).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());
}

export async function getSupplierBalance(name: string): Promise<number> {
    const summaries = await getSuppliersSummaries();
    const summary = summaries.find(s => s.name.toLowerCase() === name.toLowerCase());
    return summary ? summary.balance : 0;
}

export async function getCustomerBalance(name: string): Promise<number> {
    const summaries = await getCustomersSummaries();
    const summary = summaries.find(s => s.name.toLowerCase() === name.toLowerCase());
    return summary ? summary.balance : 0;
}
