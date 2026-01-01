"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ThermalReceipt from "@/components/ledger/ThermalReceipt";
import { DashboardLayout } from "@/components/layout";

// Helper to parse transaction notes (duplicated from LedgerEntryForm for self-containment)
const parseTransactionNote = (note: string) => {
    const lines = note.split('\n');
    let orderNumber = "";
    let partyName = "";
    let customerPhone = "";
    let customerAddress = "";
    let paymentType = "Cash";
    let itemName = "Item";
    let quantity = 1;
    let unitPrice = 0;

    lines.forEach(line => {
        if (line.startsWith("Order #")) orderNumber = line.replace("Order #", "").trim();
        else if (line.startsWith("Customer: ")) partyName = line.replace("Customer: ", "").trim();
        else if (line.startsWith("Supplier: ")) partyName = line.replace("Supplier: ", "").trim();
        else if (line.startsWith("Phone: ")) customerPhone = line.replace("Phone: ", "").trim();
        else if (line.startsWith("Address: ")) customerAddress = line.replace("Address: ", "").trim();
        else if (line.startsWith("Payment: ")) paymentType = line.replace("Payment: ", "").trim();
        else if (line.startsWith("Item: ")) {
            // Item: Name (Qty: X @ Y)
            const match = line.match(/Item: (.*) \(Qty: (\d+) @ (.*)\)/);
            if (match) {
                itemName = match[1];
                quantity = Number(match[2]);
                unitPrice = Number(match[3]);
            } else {
                itemName = line.replace("Item: ", "").trim();
            }
        }
    });

    return { orderNumber, partyName, customerPhone, customerAddress, paymentType, itemName, quantity, unitPrice };
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
                const { orderNumber, partyName, customerPhone, customerAddress, paymentType, itemName, quantity, unitPrice } = parseTransactionNote(entry.note || "");

                // Construct data for ThermalReceipt
                const item = {
                    name: itemName,
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
