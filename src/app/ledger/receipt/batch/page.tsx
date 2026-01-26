"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ThermalReceipt from "@/components/ledger/ThermalReceipt";
import { DashboardLayout } from "@/components/layout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// Helper to parse transaction notes
// Helper to parse transaction notes
const parseTransactionNote = (note: string) => {
    const lines = note.split('\n');
    let orderNumber = "";
    let partyName = "";
    let customerPhone = "";
    let customerAddress = "";
    let paymentType = "Cash";
    let itemName = "Item";
    let itemType = "Stock";
    let quantity = 1;
    let unitPrice = 0;
    let advance = undefined;
    let remaining = undefined;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("Order #")) orderNumber = trimmed.replace("Order #", "").trim();
        else if (trimmed.startsWith("Customer: ")) partyName = trimmed.replace("Customer: ", "").trim();
        else if (trimmed.startsWith("Supplier: ")) partyName = trimmed.replace("Supplier: ", "").trim();
        else if (trimmed.startsWith("Phone: ")) customerPhone = trimmed.replace("Phone: ", "").trim();
        else if (trimmed.startsWith("Address: ")) customerAddress = trimmed.replace("Address: ", "").trim();

        const amountMatch = trimmed.match(/^(Advance|Payment|Adjustment):\s*([\d\.]+(?!\s*[a-zA-Z]))/i);
        if (amountMatch) {
            advance = Number(amountMatch[2]);
        }

        const methodMatch = trimmed.match(/^Payment:\s*([a-zA-Z\s]+)$/i);
        if (methodMatch) {
            paymentType = methodMatch[1].trim();
        }

        if (trimmed.startsWith("Remaining: ")) remaining = Number(trimmed.replace("Remaining: ", "").trim());
        else if (line.startsWith("Item: ")) {
            // Robust Regex matching LedgerTable logic (updated for units)
            // Matches: [Type] Name (Qty: 1 unit @ Price)
            const match = line.match(/Item: (?:\[(.*?)\]\s*)?(.*?)\s*\(Qty: (.*?)\s*@\s*(.*)\)/);
            if (match) {
                itemType = match[1] || "Stock";
                itemName = match[2].trim();
                // If quantity has units (e.g. "1 m"), parseFloat will take "1"
                quantity = parseFloat(match[3]) || 1;
                unitPrice = Number(match[4]);
            } else {
                itemName = line.replace("Item: ", "").trim();
                // Fallback cleanup if regex fails but format is similar
                itemName = itemName.replace(/^\[.*?\]\s*/, ""); // Remove [Stock] etc
                itemName = itemName.replace(/\(Qty:.*\)$/, ""); // Remove (Qty: ...) tail
            }
        }
    });

    return { orderNumber, partyName, customerPhone, customerAddress, paymentType, itemName, itemType, quantity, unitPrice, advance, remaining };
};

function BatchReceiptContent() {
    const searchParams = useSearchParams();
    const idsString = searchParams.get("ids") || "";
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!idsString) {
            setError("No transaction IDs provided");
            setLoading(false);
            return;
        }

        const ids = idsString.split(",");

        const fetchAll = async () => {
            try {
                const results = await Promise.all(
                    ids.map(id => fetch(`/api/ledger/${id}`, { cache: 'no-store' }).then(res => {
                        if (!res.ok) throw new Error(`Failed to fetch ${id}`);
                        return res.json();
                    }))
                );

                if (results.length === 0) throw new Error("No transactions found");

                // Use the first entry for header info (party, date, etc)
                const first = results[0];
                const meta = parseTransactionNote(first.note || "");

                // Combine all items
                const combinedItems = results.map(entry => {
                    const parsed = parseTransactionNote(entry.note || "");
                    return {
                        name: parsed.itemName,
                        itemType: parsed.itemType,
                        quantity: parsed.quantity,
                        unitPrice: parsed.unitPrice || Number(entry.amount) / parsed.quantity || 0,
                        amount: Number(entry.amount)
                    };
                });

                const total = combinedItems.reduce((acc, it) => acc + it.amount, 0);
                const advance = meta.advance; // undefined if not present
                // Recalculate remaining to ensure it matches the items displayed
                let remaining: number | undefined = meta.remaining;

                if (advance !== undefined && remaining === undefined) {
                    remaining = total - advance;
                }

                // FETCH HISTORY for the receipt
                let history: any[] = [];
                try {
                    const hRes = await fetch(`/api/ledger?search=${encodeURIComponent(meta.partyName)}&limit=100`);
                    if (hRes.ok) {
                        const hData = await hRes.json();
                        history = (hData.data || [])
                            .filter((e: any) => new Date(e.date) <= new Date(first.date))
                            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    }
                } catch (e) {
                    console.error("Failed to fetch history for receipt", e);
                }

                setData({
                    title: "Order RECEIPT",
                    id: first.id, // Primary ID for QR
                    date: first.date,
                    status: meta.paymentType,
                    customerName: meta.partyName,
                    customerPhone: meta.customerPhone,
                    customerAddress: meta.customerAddress,
                    items: combinedItems,
                    total: total,
                    advance: advance,
                    remaining: remaining,
                    notes: `Batch of ${results.length} items`,
                    orderNumber: first.orderNumber || meta.orderNumber,
                    history: history
                });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [idsString]);

    if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;
    if (error) return <div className="p-12 text-center text-red-600 font-bold">{error}</div>;
    if (!data) return null;

    return <ThermalReceipt data={data} autoPrint={false} />;
}

export default function BatchReceiptPage() {
    return (
        <DashboardLayout>
            <div className="w-full h-full flex flex-col">
                <div className="mb-4 print:hidden">
                    <h1 className="text-2xl font-bold text-gray-800">Order Receipt</h1>
                </div>
                <Suspense fallback={<LoadingSpinner />}>
                    <BatchReceiptContent />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
