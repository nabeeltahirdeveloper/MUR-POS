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
    orderNumber?: string | number;
    isPaymentOnly?: boolean;
    history?: {
        date: string | Date;
        type: string;
        amount: number;
        note?: string;
    }[];
};

type ThermalReceiptProps = {
    data: ReceiptData;
    onClose?: () => void;
    autoPrint?: boolean;
};

export default function ThermalReceipt({ data, onClose, autoPrint = false }: ThermalReceiptProps) {
    const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm" | "210mm">("80mm");
    const [currency, setCurrency] = useState({ symbol: "Rs.", code: "PKR", position: "prefix" });

    useEffect(() => {
        // Fetch currency settings
        fetch("/api/settings")
            .then(res => res.json())
            .then(data => {
                if (data && data.currency) {
                    setCurrency(data.currency);
                }
            })
            .catch(err => console.error("Failed to load receipt settings", err));

        if (autoPrint) {
            // Small delay to ensure render
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [autoPrint]);

    const fmt = (n: number) =>
        new Intl.NumberFormat("en-PK", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Number(n || 0));

    const priceDisplay = (val: number) => {
        const formatted = fmt(val);
        return currency.position === 'prefix' ? `${currency.symbol}${formatted}` : `${formatted} ${currency.symbol}`;
    }

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
                    /* Prevent extra blank pages caused by full-screen layouts */
                    .min-h-screen {
                        min-height: auto !important;
                        height: auto !important;
                    }
                    /* Hide app chrome in print preview */
                    header, nav, aside, .sidebar, .topbar, .header, .search, .toggle, .bell, .app-header, .AppHeader, .site-header { display: none !important; visibility: hidden !important; }
                    .print-hide { display: none !important; }
                    .receipt {
                        width: var(--paper-width) !important;
                        margin: 0 auto !important;
                        overflow: visible !important;
                        padding: 0 6mm !important;
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
                    
                    /* Optimize logo for thermal printing */
                    .receipt-logo {
                        width: 100%;
                        max-width: ${paperWidth === '210mm' ? '300px' : '250px'};
                        height: auto;
                        display: block;
                        margin: 0 auto -10px auto;
                        image-rendering: ${paperWidth === '210mm' ? 'auto' : 'pixelated'};
                        ${paperWidth !== '210mm' ? 'filter: contrast(160%);' : ''}
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        position: relative !important;
                    }
                    .receipt-title {
                        margin-top: -20px !important;
                        position: relative !important;
                        z-index: 10 !important;
                    }
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
                                <option value="210mm">A4</option>
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

                    <div className="text-center mb-2 pt-4">
                        {/* Logo */}
                        <div className="flex justify-center">
                            <img
                                src="/favicon.jpeg"
                                alt="logo"
                                className="receipt-logo block object-contain -mb-8 -mt-8 "
                                style={{
                                    maxWidth: paperWidth === "58mm" ? "48mm" : paperWidth === "80mm" ? "70mm" : "120mm",
                                    height: "auto",
                                }}
                            />
                        </div>

                        {/* Title */}
                        <div className="text-sm text-gray-900 tracking-wide font-semibold uppercase relative z-50 mt-2 receipt-title">
                            {data.title || "RECEIPT"}
                        </div>
                    </div>

                    <div className="border-b-2 border-gray-800 relative z-50 mb-3"></div>

                    {/* Barcode & Meta */}
                    <div className="my-3 border-t-2 border-b-2 border-gray-800 py-2 text-base relative z-10">
                        <div className="flex flex-col items-center text-center">
                            {/* QR Code */}
                            <img
                                src={`https://bwipjs-api.metafloor.com/?bcid=qrcode&text=${encodeURIComponent(data.id)}&scale=4&padding=10`}
                                alt={data.id}
                                className="w-[180px] h-[180px]"
                                style={{ display: 'block' }}
                            />

                            <div className="mt-2 w-full text-base font-semibold text-gray-900">
                                {data.orderNumber && (
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold">Order #:</span>
                                        <span className="font-semibold">{data.orderNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Date:</span>
                                    <span className="font-semibold">{new Date(data.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">Time:</span>
                                    <span className="font-semibold">{new Date().toLocaleTimeString()}</span>
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
                    </div>

                    {/* Items Table - Show whenever there are items, and NOT for Direct Payment to Supplier */}
                    {data.items && data.items.length > 0 && !data.items.some(item => item.name.toLowerCase().includes("direct payment to supplier")) && (
                        <div className="mt-3 border-t-2 border-gray-800 pt-2">
                            <table className="w-full table-fixed text-base font-semibold text-gray-900">
                                <thead>
                                    <tr className="border-b border-gray-400 text-sm">
                                        <th className="text-left py-1 w-[45%]">Item</th>
                                        <th className="text-right py-1 w-[20%]">Price</th>
                                        <th className="text-center py-1 w-[15%]">Qty</th>
                                        <th className="text-right py-1 w-[20%]">Amt</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {data.items.map((item, idx) => (
                                        <tr
                                            key={idx}
                                            className="border-b border-dashed border-gray-300 align-middle"
                                        >
                                            {/* Item Name */}
                                            <td className="py-1 text-left pr-1 align-middle">
                                                <div className="break-words whitespace-normal leading-tight">
                                                    {item.name}
                                                </div>

                                                {item.itemType && (
                                                    <div className="text-xs text-gray-600">
                                                        ({item.itemType.toLowerCase().startsWith('custom') || item.itemType === 'Customize' ? 'C' : 'S'})
                                                    </div>
                                                )}
                                            </td>

                                            {/* Price */}
                                            <td className="py-1 text-right whitespace-nowrap align-middle">
                                                {fmt(item.unitPrice)}
                                            </td>

                                            {/* Quantity */}
                                            <td className="py-1 text-center align-middle">
                                                {item.quantity}
                                            </td>

                                            {/* Amount */}
                                            <td className="py-1 text-right whitespace-nowrap align-middle">
                                                {fmt(item.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                    )}


                    {/* Totals */}
                    <div className="mt-3 border-t-2 border-gray-800 pt-2 text-base">
                        {(data.advance !== undefined && data.remaining !== undefined) ? (
                            data.isPaymentOnly ? (
                                <>
                                    <div className="flex justify-between font-bold text-lg text-gray-900 mt-1">
                                        <span>TOTAL BILL</span>
                                        <span>{currency.code} {fmt(data.total)}</span>
                                    </div>
                                    <div className="border-t border-dashed border-gray-400 mt-1 pt-1 mb-1"></div>
                                    <div className="flex justify-between font-semibold text-sm text-gray-900 mt-1">
                                        <span>PAID</span>
                                        <span>{currency.code} {fmt(data.advance || 0)}</span>
                                    </div>
                                    <div className="border-t border-double border-gray-800 mt-1 pt-1"></div>
                                    <div className="flex justify-between font-bold text-base text-gray-900 mt-1 mb-2">
                                        <span>BALANCE DUE</span>
                                        <span>{currency.code} {fmt(data.remaining || 0)}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between font-bold text-lg text-gray-900 mt-1">
                                        <span>TOTAL (Items)</span>
                                        <span>{currency.code} {fmt(data.total)}</span>
                                    </div>
                                    <div className="border-t border-dashed border-gray-400 mt-1 pt-1 mb-1"></div>
                                    <div className="flex justify-between font-semibold text-sm text-gray-900 mt-1">
                                        <span>Paid Amount</span>
                                        <span>{currency.code} {fmt(data.advance || 0)}</span>
                                    </div>
                                    <div className="border-t border-double border-gray-800 mt-1 pt-1"></div>
                                    <div className="flex justify-between font-bold text-base text-gray-900 mt-1 mb-2">
                                        <span>Account Balance</span>
                                        <span>{currency.code} {fmt(data.remaining || 0)}</span>
                                    </div>
                                </>
                            )
                        ) : (
                            <div className="flex justify-between font-bold text-lg text-gray-900 mt-1">
                                <span>TOTAL</span>
                                <span>{currency.code} {fmt(data.total)}</span>
                            </div>
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
