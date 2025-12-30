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
                :root { --paper-width: ${paperWidth}; }
                @media print {
                    html, body { 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        background: white !important; 
                        min-height: auto !important; 
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        color: #000 !important;
                    }
                    /* Hide app chrome in print preview */
                    header, nav, aside, .sidebar, .topbar, .header, .search, .toggle, .bell, .app-header, .AppHeader, .site-header { display: none !important; visibility: hidden !important; }
                    .print-hide { display: none !important; }
                    .receipt {
                        width: var(--paper-width) !important;
                        margin: 0 auto !important;
                        padding: 8mm 6mm !important;
                        box-shadow: none !important;
                        border: none !important;
                        position: relative !important;
                        max-width: var(--paper-width) !important;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        height: auto !important;
                        min-height: auto !important;
                        color: #000 !important;
                    }
                    /* Crisp text rendering */
                    .receipt * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        color: inherit !important;
                        -webkit-font-smoothing: antialiased !important;
                        -moz-osx-font-smoothing: grayscale !important;
                    }
                    /* Make borders crisp */
                    .receipt div, .receipt span { border-color: #000 !important; }
                    /* Ensure only the receipt is visible in print */
                    body * { visibility: hidden; }
                    .receipt, .receipt * { visibility: visible; }
                    @page { margin: 0; size: auto; }
                    .receipt { page-break-inside: avoid; display: block !important; }
                    
                }
            `}</style>

            <div className="bg-gray-100 text-black py-6 print:bg-white print:py-0">
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

                    <div className="text-center mb-3 pb-2 border-b-2 border-gray-800">
                        <div className="text-3xl font-bold text-gray-900 mb-1">⚡ Moon Traders</div>
                        <div className="text-sm text-gray-900 tracking-wide font-semibold uppercase">Purchase Order</div>
                    </div>

                    <div className="my-3 border-t-2 border-b-2 border-gray-800 py-2 text-base">
                        <div className="flex flex-col items-center text-center">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`PO-${po.id}`)}`}
                                alt={`PO-${po.id}`}
                                style={{ width: 120, height: 120, display: 'block' }}
                            />
                            <div className="sr-only">{po.id}</div>
                            <div className="mt-2 w-full text-base font-semibold text-gray-900">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Date:</span>
                                    <span className="font-semibold">{new Date(po.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Time:</span>
                                    <span className="font-semibold">{new Date(po.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold">Status:</span>
                                    <span className="font-semibold uppercase">{po.status}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-base mb-3 border-t-2 border-gray-800 pt-2 text-gray-900">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold">Name:</span>
                            <span className="font-semibold text-right">{supplier.name || "—"}</span>
                        </div>
                        {supplier.phone && (
                            <div className="flex justify-between mb-1">
                                <span className="font-bold">Contact:</span>
                                <span className="font-semibold text-right">{supplier.phone}</span>
                            </div>
                        )}
                        {supplier.address && (
                            <div className="flex justify-between">
                                <span className="font-bold">Detail:</span>
                                <span className="whitespace-pre-wrap text-sm font-semibold text-right">{supplier.address}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-t-2 border-gray-800 pt-2">
                        <div className="grid grid-cols-[1fr_4ch_8ch_9ch] gap-2 text-sm font-bold text-gray-900">
                            <div>ITEM</div>
                            <div className="text-right">QTY</div>
                            <div className="text-right">PRICE</div>
                            <div className="text-right">AMT</div>
                        </div>
                        <div className="mt-1 border-t-2 border-gray-600" />
                        <div className="mt-2 space-y-1 text-base font-semibold text-gray-900">
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

                    <div className="mt-3 border-t-2 border-gray-800 pt-2 text-base">
                        <div className="flex justify-between font-bold text-lg text-gray-900">
                            <span>TOTAL</span>
                            <span>PKR {fmt(total)}</span>
                        </div>
                    </div>

                    {(po.notes || po.terms) && (
                        <div className="mt-3 border-t-2 border-gray-800 pt-2 text-sm font-semibold text-gray-900">
                            {po.notes ? (
                                <div className="mb-2">
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold">Notes:</span>
                                        <span className="whitespace-pre-wrap text-sm text-right">{po.notes}</span>
                                    </div>
                                </div>
                            ) : null}
                            {po.terms ? (
                                <div>
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold">Terms:</span>
                                        <span className="whitespace-pre-wrap text-sm text-right">{po.terms}</span>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    <div className="mt-4 text-center text-sm font-semibold text-gray-800">
                        --- END ---
                    </div>
                </div>
            </div>
        </>
    );
}
