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
        if (line.startsWith("Order #")) orderNumber = line.replace("Order #", "").trim();
        else if (line.startsWith("Customer: ")) partyName = line.replace("Customer: ", "").trim();
        else if (line.startsWith("Supplier: ")) partyName = line.replace("Supplier: ", "").trim();
        else if (line.startsWith("Phone: ")) customerPhone = line.replace("Phone: ", "").trim();
        else if (line.startsWith("Address: ")) customerAddress = line.replace("Address: ", "").trim();
        else if (line.startsWith("Payment: ")) paymentType = line.replace("Payment: ", "").trim();
        else if (line.startsWith("Advance: ")) advance = Number(line.replace("Advance: ", "").trim());
        else if (line.startsWith("Remaining: ")) remaining = Number(line.replace("Remaining: ", "").trim());
        else if (line.startsWith("Item: ")) {
            const match = line.match(/Item: (?:\[(.*?)\] )?(.*) \(Qty: (\d+) @ (.*)\)/);
            if (match) {
                itemType = match[1] || "Stock";
                itemName = match[2];
                quantity = Number(match[3]);
                unitPrice = Number(match[4]);
            } else {
                itemName = line.replace("Item: ", "").trim();
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
                    ids.map(id => fetch(`/api/ledger/${id}`).then(res => {
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
                        unitPrice: parsed.unitPrice || (entry.amount / parsed.quantity) || 0,
                        amount: Number(entry.amount)
                    };
                });

                const total = combinedItems.reduce((acc, it) => acc + it.amount, 0);

                setData({
                    title: "BILL RECEIPT",
                    id: first.id, // Primary ID for QR
                    date: first.date,
                    status: meta.paymentType,
                    customerName: meta.partyName,
                    customerPhone: meta.customerPhone,
                    customerAddress: meta.customerAddress,
                    items: combinedItems,
                    total: total,
                    advance: meta.advance,
                    remaining: meta.remaining,
                    notes: `Batch of ${results.length} items`
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
                    <h1 className="text-2xl font-bold text-gray-800">Bill Receipt</h1>
                </div>
                <Suspense fallback={<LoadingSpinner />}>
                    <BatchReceiptContent />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
