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
        // For suppliers, we primarily look at Ledger Entires marked with "Supplier:"
        // We currently DO NOT include Debts/Loans in the Supplier view to avoid overlap with Customers view,
        // as Debts in this system are currently generic "personName" based and usually imply Customer loans.
        const ledgerEntries = await getAllDocs<FirestoreLedger>('ledger');

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

        // 1. Process Ledger entries
        ledgerEntries.forEach(entry => {
            if (!entry.note) return;

            // Extract supplier name from structured note
            const lines = entry.note.split('\n');
            let supplierName = "";
            lines.forEach(line => {
                if (line.startsWith("Supplier: ")) {
                    supplierName = line.replace("Supplier: ", "").trim();
                }
            });

            if (supplierName) {
                updateSupplier(supplierName, entry.type, Number(entry.amount), entry.date);
            }
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
