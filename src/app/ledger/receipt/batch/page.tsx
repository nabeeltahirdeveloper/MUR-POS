"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ThermalReceipt from "@/components/ledger/ThermalReceipt";
import { DashboardLayout } from "@/components/layout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { parseReceiptNote } from "@/lib/transaction-parser";

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

        const ids = [...new Set(idsString.split(","))];

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
                const meta = parseReceiptNote(first.note || "");

                // Combine all items
                const combinedItems = results.map(entry => {
                    const parsed = parseReceiptNote(entry.note || "");
                    return {
                        name: parsed.itemName,
                        itemType: parsed.itemType,
                        quantity: parsed.quantity,
                        unitPrice: parsed.unitPrice || Number(entry.amount) / (parsed.quantity || 1) || 0,
                        amount: Number(entry.amount)
                    };
                });

                const total = combinedItems.reduce((acc, it) => acc + it.amount, 0);

                // Fetch computed balance from API (source of truth)
                let remaining: number | undefined = undefined;

                if (meta.title && meta.title !== "-") {
                    try {
                        const isSupplier = (first.note || "").includes("Supplier:");
                        const balanceEndpoint = isSupplier ? "/api/ledger/suppliers" : "/api/ledger/customers";
                        const balRes = await fetch(balanceEndpoint, { cache: 'no-store' });
                        if (balRes.ok) {
                            const balances: { name: string; balance: number; totalCredit: number; totalDebit: number }[] = await balRes.json();
                            const match = balances.find(
                                b => b.name.trim().toLowerCase() === meta.title.trim().toLowerCase()
                            );
                            if (match) {
                                remaining = match.balance;
                            }
                        }
                    } catch (e) {
                        console.error("Failed to fetch computed balance, using note-based fallback", e);
                    }
                }

                if (remaining === undefined) {
                    remaining = meta.remaining;
                }

                // Sum advances from all entries in the batch, deduplicating by order number
                // (entries in the same order share one advance, not additive)
                let advance: number | undefined = 0;
                const processedOrders = new Set<string>();
                results.forEach(entry => {
                    const parsed = parseReceiptNote(entry.note || "");
                    const orderNum = parsed.orderNumber || entry.id;
                    if (parsed.advance !== undefined && !processedOrders.has(orderNum)) {
                        advance = (advance || 0) + parsed.advance;
                        processedOrders.add(orderNum);
                    }
                });
                if (advance === 0) advance = meta.advance;

                // FETCH HISTORY for the receipt
                let history: any[] = [];
                try {
                    const hRes = await fetch(`/api/ledger?search=${encodeURIComponent(meta.title)}&limit=100`);
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
                    customerName: meta.title,
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
