import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Timestamp } from "@/lib/prisma-helpers";
import { queryDocs, getDocById } from "@/lib/prisma-helpers";
import type { FirestoreLedger, FirestoreItem } from "@/types/firestore";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // Fetch counts and summaries in parallel
        const [
            ledgerRes, 
            items, 
            utilities, 
            expenses, 
            debts
        ] = await Promise.all([
            queryDocs<FirestoreLedger>('ledger', [
                { field: 'date', operator: '>=', value: Timestamp.fromDate(today) },
                { field: 'date', operator: '<', value: Timestamp.fromDate(tomorrow) },
            ]),
            queryDocs<FirestoreItem>('items', []),
            queryDocs<any>('utilities', [{ field: 'status', operator: '==', value: 'unpaid' }]),
            queryDocs<any>('other_expenses', [{ field: 'status', operator: '==', value: 'unpaid' }]),
            queryDocs<any>('debts', [{ field: 'status', operator: '==', value: 'active' }])
        ]);

        // Process items for stock value and low stock
        let totalStockValue = 0;
        let lowStockCount = 0;
        if (Array.isArray(items)) {
            items.forEach((item: any) => {
                const stock = item.currentStock || 0;
                const price = item.secondPurchasePrice || 0;
                totalStockValue += (stock * price);
                if (item.isLowStock) lowStockCount++;
            });
        }

        // Process ledger totals logic (similar to /api/ledger/summary/total)
        let totalCredit = 0;
        let totalDebit = 0;
        const processedOrderNumbers = new Set<string>();

        if (Array.isArray(ledgerRes)) {
            for (const entry of (ledgerRes as FirestoreLedger[])) {
                if (entry.note && entry.note.startsWith("Utility payment:")) continue;
                const orderNum = entry.orderNumber ? String(entry.orderNumber) : null;
                if (orderNum && processedOrderNumbers.has(orderNum)) continue;
                if (orderNum) processedOrderNumbers.add(orderNum);

                const totalAmount = Number(entry.amount);
                let cashMoved = totalAmount; // Default fallback simplified for summary
                
                if (entry.note) {
                    const advMatch = entry.note.match(/^(Advance|Payment|Paid):\s*(\d+(\.\d+)?)/i);
                    if (advMatch) {
                        cashMoved = Number(advMatch[2]) || 0;
                    } else if (entry.note.match(/Remaining:\s*(\d+(\.\d+)?)/i)) {
                        // If it has remaining but no payment/advance line, it might be 0 cash moved
                        if (!entry.note.match(/^(Advance|Payment|Paid):/i)) {
                            cashMoved = 0; 
                        }
                    }
                }

                if (entry.type === "credit") totalCredit += cashMoved;
                else if (entry.type === "debit") totalDebit += cashMoved;
            }
        }

        return NextResponse.json({
            stock: {
                totalValue: totalStockValue,
                totalItems: items.length,
                lowStockCount
            },
            counts: {
                unpaidUtilities: utilities.length,
                unpaidExpenses: expenses.length,
                activeDebts: debts.length
            },
            ledger: {
                totalCredit,
                totalDebit,
                net: totalCredit - totalDebit
            }
        });
    } catch (error) {
        console.error("Dashboard summary API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
