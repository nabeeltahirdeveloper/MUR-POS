"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ThermalReceipt from "@/components/ledger/ThermalReceipt";
import { DashboardLayout } from "@/components/layout";

// Helper to parse transaction notes (duplicated from LedgerEntryForm for self-containment)
// Helper to parse transaction notes (duplicated from LedgerEntryForm for self-containment)
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
            // Robust Regex matching LedgerTable logic
            const match = line.match(/Item:\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*\(Qty:\s*([\d\.]+)\s*@\s*([^)]*)\)/);
            if (match) {
                // match[1] is Type (Group 1)
                // match[2] is Name (Group 2)
                itemType = match[1] || "Stock";
                itemName = match[2].trim();

                // Clean up if valid Type was caught inside Name due to weird spacing
                if (itemName.startsWith("[") && !match[1]) {
                    const endBracket = itemName.indexOf(']');
                    if (endBracket > 0) {
                        itemType = itemName.substring(1, endBracket);
                        itemName = itemName.substring(endBracket + 1).trim();
                    }
                }

                quantity = Number(match[3]);
                unitPrice = Number(match[4]);
            } else {
                itemName = line.replace("Item: ", "").trim();
            }
        }
    });

    return { orderNumber, partyName, customerPhone, customerAddress, paymentType, itemName, itemType, quantity, unitPrice, advance, remaining };
};

export default function ReceiptPage() {
    const params = useParams();
    const id = params?.id as string;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;

        fetch(`/api/ledger/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch transaction");
                return res.json();
            })
            .then(entry => {
                const { orderNumber, partyName, customerPhone, customerAddress, paymentType, itemName, itemType, quantity, unitPrice, advance, remaining } = parseTransactionNote(entry.note || "");

                // Construct data for ThermalReceipt
                const item = {
                    name: itemName,
                    itemType: itemType,
                    quantity: quantity,
                    unitPrice: unitPrice || (entry.amount / quantity) || 0,
                    amount: Number(entry.amount)
                };

                setData({
                    title: "PAYMENT RECEIPT",
                    id: entry.id,
                    date: entry.date,
                    status: paymentType, // Use payment type as status (Online/Cash)
                    customerName: partyName,
                    customerPhone: customerPhone,
                    customerAddress: customerAddress,
                    items: [item],
                    total: Number(entry.amount),
                    advance: advance,
                    remaining: remaining,
                    notes: entry.note
                });
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    return (
        <DashboardLayout>
            <div className="w-full h-full flex flex-col">
                <div className="mb-4 print:hidden">
                    <h1 className="text-2xl font-bold text-gray-800">Transaction Receipt</h1>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center min-h-[50vh] text-red-600">
                        <p>Error: {error}</p>
                    </div>
                ) : data ? (
                    <div className="flex-1">
                        <ThermalReceipt data={data} autoPrint={false} />
                    </div>
                ) : null}
            </div>
        </DashboardLayout>
    );
}
