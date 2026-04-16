import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllDocs } from "@/lib/prisma-helpers";
import type { FirestoreLedger } from "@/types/firestore";

// Helper to parse transaction notes
const parseTransactionNote = (note: string) => {
    const lines = note.split('\n');
    let orderNumber = "";
    let paymentType = "Cash";
    let advance: number | undefined = undefined;
    let remaining: number | undefined = undefined;
    let itemName = "";
    let quantity = "";

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("Order #")) orderNumber = trimmed.replace("Order #", "").trim();
        else if (trimmed.startsWith("Payment: ")) {
            const val = trimmed.replace("Payment: ", "").trim();
            // If it's a number, it's the payment amount (common in debit entries)
            if (!isNaN(Number(val)) && val !== "") {
                advance = Number(val);
            } else {
                paymentType = val;
            }
        }
        else if (trimmed.startsWith("Advance: ")) advance = Number(trimmed.replace("Advance: ", "").trim());
        else if (trimmed.startsWith("Remaining: ")) remaining = Number(trimmed.replace("Remaining: ", "").trim());
        else if (trimmed.startsWith("Item: ")) {
            // Item: [Type] Name (Qty: X @ Y)
            const match = trimmed.match(/Item: (?:\[(.*?)\]\s*)?(.*?)\s*\(Qty: (.*?)\)/);
            if (match) {
                itemName = match[2];
                // Extract only quantity part before "@" or " " if present
                const fullQty = (match[3] || "").trim();
                quantity = fullQty.split(/[\s@]/)[0].trim();
            }
        }
    });

    return { orderNumber, paymentType, advance, remaining, itemName, quantity };
};

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const supplierName = searchParams.get("supplierName")?.trim();

        if (!supplierName) {
            return NextResponse.json(
                { error: "Supplier name is required" },
                { status: 400 }
            );
        }

        // Fetch all ledger entries
        const allEntries = await getAllDocs<FirestoreLedger>('ledger');

        // Filter for debit entries (Cash-Out) that match the supplier name
        const supplierEntries = allEntries
            .filter(entry => {
                if (entry.type !== 'debit') return false;
                if (!entry.note) return false;

                // Check if note contains "Supplier: {supplierName}" (case-insensitive)
                const supplierMatch = entry.note.match(/Supplier:\s*([^\n]+)/i);
                if (!supplierMatch) return false;

                const matchName = supplierMatch[1].trim();
                return matchName.toLowerCase() === supplierName.toLowerCase();
            })
            .sort((a, b) => {
                // Sort by date descending
                const dateA = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
                const dateB = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
                return dateB.getTime() - dateA.getTime();
            });

        // Group entries by order number
        const orderMap = new Map<string, {
            entries: (FirestoreLedger & { id: string })[];
            totalAmount: number;
            date: Date;
            orderNumber: string;
            itemCount: number;
        }>();

        supplierEntries.forEach(entry => {
            const parsed = parseTransactionNote(entry.note || "");
            const orderNum = parsed.orderNumber || entry.orderNumber?.toString() || `single-${entry.id}`;

            if (!orderMap.has(orderNum)) {
                const entryDate = entry.date instanceof Date
                    ? entry.date
                    : (entry.date?.toDate ? entry.date.toDate() : new Date(entry.date));

                orderMap.set(orderNum, {
                    entries: [],
                    totalAmount: 0,
                    date: entryDate,
                    orderNumber: orderNum,
                    itemCount: 0
                });
            }

            const order = orderMap.get(orderNum)!;
            order.entries.push(entry);
            order.totalAmount += Number(entry.amount);
            order.itemCount++;
        });

        // Convert grouped orders to formatted transactions
        const formattedTransactions = Array.from(orderMap.values())
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 100) // Take only the latest 100 orders
            .map(order => {
                // Use the first entry for common fields
                const firstEntry = order.entries[0];
                const parsed = parseTransactionNote(firstEntry.note || "");

                // Collect all item names and quantities
                const itemNames = order.entries
                    .map(e => parseTransactionNote(e.note || "").itemName)
                    .filter(name => name && name.trim())
                    .join(", ");

                const itemQuantities = order.entries
                    .map(e => parseTransactionNote(e.note || "").quantity)
                    .filter(qty => qty && qty.trim())
                    .join(", ");

                return {
                    id: order.orderNumber,
                    entryIds: order.entries.map(e => e.id), // actual Firestore doc IDs
                    date: order.date.toISOString(),
                    orderNumber: order.orderNumber.startsWith('single-') ? "-" : order.orderNumber,
                    type: firstEntry.type,
                    amount: order.totalAmount,
                    paymentType: parsed.paymentType,
                    advance: parsed.advance,
                    remaining: parsed.remaining,
                    itemName: itemNames || (order.itemCount > 1 ? `${order.itemCount} items` : ""),
                    quantity: itemQuantities || "-",
                    itemCount: order.itemCount,
                };
            });

        return NextResponse.json({
            supplierName,
            transactions: formattedTransactions,
            total: formattedTransactions.length
        });

    } catch (error: any) {
        console.error("Error fetching supplier history:", error);
        return NextResponse.json(
            { error: "Failed to fetch supplier history" },
            { status: 500 }
        );
    }
}
