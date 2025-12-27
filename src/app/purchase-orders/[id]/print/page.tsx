"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PaperWidth = "80mm" | "58mm";

interface PurchaseOrderItem {
    itemId: string;
    qty: number;
    pricePerUnit: number;
    item?: { name?: string | null } | null;
}

interface PurchaseOrder {
    id: string;
    createdAt: string | Date;
    status: string;
    supplier?: { name?: string | null; phone?: string | null; address?: string | null } | null;
    notes?: string | null;
    terms?: string | null;
    items: PurchaseOrderItem[];
}

export default function PrintPurchaseOrderPage() {
    const params = useParams();
    const id = params.id as string;
    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [paperWidth, setPaperWidth] = useState<PaperWidth>("80mm");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/purchase-orders/${id}`)
            .then(res => res.json())
            .then(data => {
                setPo(data);
                setLoading(false);
                setError(null);
            })
            .catch((e) => {
                console.error(e);
                setError("Failed to load purchase order");
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!po) return;
        document.title = `PO-${po.id}`;
    }, [po]);

    if (loading) return <div className="p-8">Loading...</div>;
    if (error) return <div className="p-8 text-red-600">{error}</div>;
    if (!po) return <div className="p-8">Not found</div>;

    const items: PurchaseOrderItem[] = Array.isArray(po.items) ? po.items : [];
    const total = items.reduce((sum, i) => sum + (Number(i.qty) * Number(i.pricePerUnit)), 0);
    const supplier = po.supplier || {};

    const fmt = (n: number) =>
        new Intl.NumberFormat("en-PK", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(n || 0));

    return (
        <>
            <style jsx global>{`
                :root {
                    --paper-width: ${paperWidth};
                }
                @media print {
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    .print-hide { display: none !important; }
                    .receipt {
                        width: var(--paper-width) !important;
                        margin: 0 !important;
                        padding: 6mm 4mm !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    @page {
                        margin: 0;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-gray-100 text-black py-6 print:bg-white print:py-0">
                <div
                    className="receipt mx-auto bg-white border border-gray-200 shadow-sm rounded-md"
                    style={{ width: paperWidth, padding: "10mm 6mm", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}
                >
                    <div className="print-hide mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700">Paper</label>
                            <select
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                                value={paperWidth}
                                onChange={(e) => setPaperWidth(e.target.value as PaperWidth)}
                            >
                                <option value="80mm">80mm</option>
                                <option value="58mm">58mm</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => window.print()}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                            >
                                Print
                            </button>
                            <button
                                onClick={() => window.close()}
                                className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    <div className="text-center">
                        <div className="text-lg font-bold">Moon Traders</div>
                        <div className="text-sm">Purchase Order (PKR)</div>
                    </div>

                    <div className="my-3 border-t border-b border-dashed border-gray-400 py-2 text-sm">
                        <div className="flex justify-between">
                            <span>PO#</span>
                            <span>{po.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Date</span>
                            <span>{new Date(po.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Status</span>
                            <span className="uppercase">{po.status}</span>
                        </div>
                    </div>

                    <div className="text-sm mb-3">
                        <div className="font-bold">{supplier.name || "Supplier"}</div>
                        {supplier.phone ? <div>{supplier.phone}</div> : null}
                        {supplier.address ? <div className="whitespace-pre-wrap">{supplier.address}</div> : null}
                    </div>

                    <div className="border-t border-dashed border-gray-400 pt-2">
                        <div className="grid grid-cols-[1fr_4ch_8ch_9ch] gap-2 text-xs font-bold">
                            <div>ITEM</div>
                            <div className="text-right">QTY</div>
                            <div className="text-right">PRICE</div>
                            <div className="text-right">AMT</div>
                        </div>
                        <div className="mt-1 border-t border-dashed border-gray-300" />
                        <div className="mt-2 space-y-1 text-sm">
                            {items.map((it, idx) => {
                                const qty = Number(it.qty) || 0;
                                const price = Number(it.pricePerUnit) || 0;
                                const amt = qty * price;
                                return (
                                    <div key={idx} className="grid grid-cols-[1fr_4ch_8ch_9ch] gap-2">
                                        <div className="truncate">{it.item?.name || "Unknown Item"}</div>
                                        <div className="text-right">{qty}</div>
                                        <div className="text-right">{fmt(price)}</div>
                                        <div className="text-right">{fmt(amt)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-3 border-t border-dashed border-gray-400 pt-2 text-sm">
                        <div className="flex justify-between font-bold">
                            <span>TOTAL</span>
                            <span>PKR {fmt(total)}</span>
                        </div>
                    </div>

                    {(po.notes || po.terms) && (
                        <div className="mt-3 border-t border-dashed border-gray-400 pt-2 text-xs">
                            {po.notes ? (
                                <div className="mb-2">
                                    <div className="font-bold">NOTES</div>
                                    <div className="whitespace-pre-wrap">{po.notes}</div>
                                </div>
                            ) : null}
                            {po.terms ? (
                                <div>
                                    <div className="font-bold">TERMS</div>
                                    <div className="whitespace-pre-wrap">{po.terms}</div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    <div className="mt-4 text-center text-xs text-gray-500">
                        --- END ---
                    </div>
                </div>
            </div>
        </>
    );
}
