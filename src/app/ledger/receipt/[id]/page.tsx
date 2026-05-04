"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ThermalReceipt from "@/components/ledger/ThermalReceipt";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DashboardLayout } from "@/components/layout";
import { parseReceiptNote } from "@/lib/transaction-parser";

export default function ReceiptPage() {
    const params = useParams();
    const id = params?.id as string;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;

        fetch(`/api/ledger/${id}`, { cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch transaction");
                return res.json();
            })
            .then(async (entry) => {
                const initialParsed = parseReceiptNote(entry.note || "");
                let receiptItems: any[] = [];
                let totalAmount = Number(entry.amount);

                if (initialParsed.orderNumber) {
                    try {
                        // Fetch all entries for this order
                        const res = await fetch(`/api/ledger?search=Order #${initialParsed.orderNumber}&limit=100`);
                        if (res.ok) {
                            const result = await res.json();
                            const siblings = (result.data || []).filter((e: any) => {
                                const p = parseReceiptNote(e.note || "");
                                return p.orderNumber === initialParsed.orderNumber;
                            });

                            if (siblings.length > 0) {
                                receiptItems = siblings.map((e: any) => {
                                    const p = parseReceiptNote(e.note || "");
                                    return {
                                        name: p.itemName,
                                        itemType: p.itemType,
                                        quantity: p.quantity,
                                        unitPrice: p.unitPrice || (Number(e.amount) / (p.quantity || 1)) || 0,
                                        amount: Number(e.amount)
                                    };
                                });
                                totalAmount = siblings.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
                            }
                        }
                    } catch (e) {
                        console.error("Failed to fetch sibling items for receipt", e);
                    }
                }

                // Fallback to single item if fetch failed or logic didn't return siblings
                if (receiptItems.length === 0) {
                    receiptItems.push({
                        name: initialParsed.itemName,
                        itemType: initialParsed.itemType,
                        quantity: initialParsed.quantity,
                        unitPrice: initialParsed.unitPrice || (entry.amount / (initialParsed.quantity || 1)) || 0,
                        amount: Number(entry.amount)
                    });
                }

                const hasRealItems = receiptItems.some((it: any) =>
                    it.name &&
                    it.name !== "-" &&
                    !/direct payment/i.test(it.name)
                );
                const isPaymentOnly = !hasRealItems;
                const isSupplier = (entry.note || "").includes("Supplier:");

                // Advance/remaining:
                // - Payment-only entries: use this entry's own note values (snapshot at save time)
                //   so the receipt matches the Recent Transactions row.
                // - Item purchases: take remaining from the live balance API.
                let advance: number | undefined = initialParsed.advance;
                let remaining: number | undefined = initialParsed.remaining;

                if (!isPaymentOnly && initialParsed.title && initialParsed.title !== "-") {
                    try {
                        const balanceEndpoint = isSupplier ? "/api/ledger/suppliers" : "/api/ledger/customers";
                        const balRes = await fetch(balanceEndpoint, { cache: 'no-store' });
                        if (balRes.ok) {
                            const balances: { name: string; balance: number; totalCredit: number; totalDebit: number }[] = await balRes.json();
                            const match = balances.find(
                                b => b.name.trim().toLowerCase() === initialParsed.title.trim().toLowerCase()
                            );
                            if (match) {
                                remaining = match.balance;
                            }
                        }
                    } catch (e) {
                        console.error("Failed to fetch computed balance, using note-based fallback", e);
                    }
                }

                if (advance !== undefined && remaining === undefined) {
                    remaining = Math.max(0, totalAmount - advance);
                }

                // For payment-only receipts:
                //   PAID        = advance (this transaction's payment)
                //   BALANCE DUE = remaining (state right after this payment)
                //   TOTAL BILL  = advance + remaining (state right before this payment)
                const displayTotal = isPaymentOnly
                    ? (Number(advance || 0) + Number(remaining || 0))
                    : totalAmount;
                const displayAdvance = advance;

                // FETCH HISTORY for the receipt
                let history: any[] = [];
                try {
                    const hRes = await fetch(`/api/ledger?search=${encodeURIComponent(initialParsed.title)}&limit=100`);
                    if (hRes.ok) {
                        const hData = await hRes.json();
                        history = (hData.data || [])
                            .filter((e: any) => new Date(e.date) <= new Date(entry.date))
                            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    }
                } catch (e) {
                    console.error("Failed to fetch history for receipt", e);
                }

                setData({
                    title: "PAYMENT RECEIPT",
                    id: entry.id,
                    date: entry.date,
                    status: initialParsed.paymentType, // Use payment type as status (Online/Cash)
                    customerName: initialParsed.title,
                    customerPhone: initialParsed.customerPhone,
                    customerAddress: initialParsed.customerAddress,
                    items: isPaymentOnly ? [] : receiptItems,
                    total: displayTotal,
                    advance: displayAdvance,
                    remaining: remaining,
                    isPaymentOnly,
                    notes: entry.note,
                    orderNumber: entry.orderNumber || initialParsed.orderNumber,
                    history: history
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
                        <LoadingSpinner />
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
