"use client";

import React, { useRef, useEffect, useState } from "react";

// Unified types to support both Ledger and Purchase Order data
export type ReceiptItem = {
    name: string;
    itemType?: string; // e.g. Stock, Customize
    quantity: number;
    unitPrice: number;
    amount: number;
};

export type ReceiptData = {
    title?: string; // e.g., "PURCHASE ORDER", "PAYMENT RECEIPT"
    id: string; // for QR code and display
    date: Date | string;
    status?: string;
    customerName?: string; // or Supplier Name
    customerPhone?: string;
    customerAddress?: string;
    items: ReceiptItem[];
    total: number;
    advance?: number;
    remaining?: number;
    notes?: string;
    terms?: string;
};

type ThermalReceiptProps = {
    data: ReceiptData;
    onClose?: () => void;
    autoPrint?: boolean;
};

export default function ThermalReceipt({ data, onClose, autoPrint = false }: ThermalReceiptProps) {
    const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");

    useEffect(() => {
        if (autoPrint) {
            // Small delay to ensure render
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [autoPrint]);

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
                        padding: 30px 6mm !important;
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

            <div className="bg-gray-100 text-black py-6 print:bg-white print:py-0 min-h-screen flex flex-col items-center">
                <div
                    className="receipt mx-auto bg-white border border-gray-200 shadow-sm rounded-md"
                    style={{ width: paperWidth, padding: "30px 6mm", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}
                >
                    {/* Controls - Hidden in print */}
                    <div className="print-hide mb-4 flex items-center justify-between gap-3 border-b pb-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700">Paper</label>
                            <select
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                                value={paperWidth}
                                onChange={(e) => setPaperWidth(e.target.value as "80mm" | "58mm")}
                            >
                                <option value="80mm">80mm</option>
                                <option value="58mm">58mm</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => window.print()}
                                className="bg-black text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-gray-800"
                            >
                                Print
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="border border-gray-300 px-4 py-1.5 rounded text-sm font-bold hover:bg-gray-50"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-3 pb-2 border-b-2 border-gray-800">
                        <img src="/favicon.jpg" alt="Logo" className="h-16 w-16 rounded-full mx-auto mb-2 object-cover" />
                        <div className="text-3xl font-bold text-gray-900 mb-1">Moon Traders</div>
                        <div className="text-sm text-gray-900 tracking-wide font-semibold uppercase">{data.title || "RECEIPT"}</div>
                    </div>

                    {/* Barcode & Meta */}
                    <div className="my-3 border-t-2 border-b-2 border-gray-800 py-2 text-base">
                        <div className="flex flex-col items-center text-center">
                            {/* QR Code */}
                            <img
                                src={`https://bwipjs-api.metafloor.com/?bcid=qrcode&text=${encodeURIComponent(data.id)}&scale=4&padding=10`}
                                alt={data.id}
                                className="w-[180px] h-[180px]"
                                style={{ display: 'block' }}
                            />

                            <div className="mt-2 w-full text-base font-semibold text-gray-900">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Date:</span>
                                    <span className="font-semibold">{new Date(data.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Time:</span>
                                    <span className="font-semibold">{new Date(data.date).toLocaleTimeString()}</span>
                                </div>
                                {data.status && (
                                    <div className="flex justify-between">
                                        <span className="font-bold">Status:</span>
                                        <span className="font-semibold uppercase">{data.status}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Customer / Supplier Info */}
                    <div className="text-base mb-3 border-t-2 border-gray-800 pt-2 text-gray-900">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold">Name:</span>
                            <span className="font-semibold text-right">{data.customerName || "Walk-in"}</span>
                        </div>
                        {data.customerPhone && (
                            <div className="flex justify-between mb-1">
                                <span className="font-bold">Contact:</span>
                                <span className="font-semibold text-right">{data.customerPhone}</span>
                            </div>
                        )}
                        {data.customerAddress && (
                            <div className="flex justify-between">
                                <span className="font-bold">Detail:</span>
                                <span className="whitespace-pre-wrap text-sm font-semibold text-right max-w-[60%]">{data.customerAddress}</span>
                            </div>
                        )}
                    </div>

                    {/* Items Table */}
                    <div className="border-t-2 border-gray-800 pt-2">
                        <div className="grid grid-cols-[1fr_4ch_8ch_9ch] gap-2 text-sm font-bold text-gray-900">
                            <div>ITEM</div>
                            <div className="text-right">QTY</div>
                            <div className="text-right">PRICE</div>
                            <div className="text-right">AMT</div>
                        </div>
                        <div className="mt-1 border-t-2 border-gray-600" />
                        <div className="mt-2 space-y-1 text-base font-semibold text-gray-900">
                            {data.items.map((it, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_4ch_8ch_9ch] gap-2">
                                    <div className="break-words">
                                        {it.name}
                                    </div>
                                    <div className="text-right">{it.quantity}</div>
                                    <div className="text-right">{fmt(it.unitPrice)}</div>
                                    <div className="text-right">{fmt(it.amount)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="mt-3 border-t-2 border-gray-800 pt-2 text-base">
                        <div className="flex justify-between font-bold text-lg text-gray-900">
                            <span>TOTAL</span>
                            <span>PKR {fmt(data.total)}</span>
                        </div>
                        {(data.advance !== undefined || data.remaining !== undefined) && (
                            <>
                                <div className="flex justify-between font-semibold text-sm text-gray-800 mt-1">
                                    <span>Advance</span>
                                    <span>PKR {fmt(data.advance || 0)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-base text-gray-900 border-t border-dashed border-gray-400 mt-1 pt-1">
                                    <span>REMAINING</span>
                                    <span>PKR {fmt(data.remaining || (data.total - (data.advance || 0)))}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-4 text-center text-sm font-semibold text-gray-800 pb-48 print:pb-[200px]">
                        --- END ---
                    </div>
                </div>
            </div>
        </>
    );
}
