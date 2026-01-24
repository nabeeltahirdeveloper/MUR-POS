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
            } else if (trimmed.toLowerCase().startsWith("remaining:")) {
                remaining = Number(trimmed.replace(/[^0-9.-]/g, '')) || 0;
            }
        });

        if (supplierName && entry.type === 'debit') {
            const party = getPartyData(supplierName);
            const amount = Number(entry.amount);
            const entryDate = entry.date instanceof Date ? entry.date : (entry.date?.toDate ? entry.date.toDate() : new Date(entry.date));

            // totalCredit is Cash-Out (Payments to supplier)
            party.totalCredit += amount;

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
    // For Suppliers: Owe (Negative) or Credit?
    // Let's use the convention: Positive Balance = We owe them (Debt).
    // This matches the Dashboard filter balance > 0.
    return Object.values(supplierMap).map(s => ({
        name: s.name,
        balance: s.latestRemaining,
        lastEntryDate: s.lastEntryDate,
        totalCredit: s.totalCredit,
        totalDebit: s.totalCredit + s.latestRemaining // Total bought = Paid + Still Owed
    })).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());
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
            } else if (trimmed.toLowerCase().startsWith("remaining:")) {
                remaining = Number(trimmed.replace(/[^0-9.-]/g, '')) || 0;
            }
        });

        if (customerName) {
            const party = getPartyData(customerName);
            const amount = Number(entry.amount);
            const entryDate = entry.date instanceof Date ? entry.date : (entry.date?.toDate ? entry.date.toDate() : new Date(entry.date));

            if (entry.type === 'credit') {
                party.totalCredit += amount;
            } else {
                // Debit from us = we paid them? Or adjustment.
            }

            if (entryDate > party.lastEntryDate) {
                party.lastEntryDate = entryDate;
                if (remaining !== null) {
                    party.latestRemaining = remaining;
                }
            }
        }
    });

    return Object.values(customerMap).map(c => ({
        name: c.name,
        balance: c.latestRemaining,
        lastEntryDate: c.lastEntryDate,
        totalCredit: c.totalCredit,
        totalDebit: c.totalCredit + c.latestRemaining
    })).sort((a, b) => b.lastEntryDate.getTime() - a.lastEntryDate.getTime());
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
