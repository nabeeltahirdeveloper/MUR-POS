"use client";

import React, { useRef, useEffect } from "react";

type ThermalReceiptProps = {
    data: {
        customerName: string;
        orderNumber: string;
        date: string;
        time: string;
        items: {
            item: { name: string };
            quantity: number;
            unitPrice: number;
            amount: number;
        }[];
        total: number;
    };
    onClose?: () => void;
    autoPrint?: boolean;
};

export default function ThermalReceipt({ data, onClose, autoPrint = false }: ThermalReceiptProps) {
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoPrint) {
            // Small delay to ensure render
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [autoPrint]);

    return (
        <div ref={receiptRef} className="flex flex-col items-center bg-white min-h-screen p-8 print:p-0 print:min-h-0">
            {/* Thermal Receipt Container - ~80mm width typical for thermal printers */}
            <div className="bg-white p-4 shadow-xl max-w-[350px] w-full print:shadow-none print:max-w-none print:w-[80mm] print:mx-auto font-mono text-xs font-bold uppercase text-black leading-tight border border-gray-200 print:border-0">

                {/* Header */}
                <div className="flex flex-col items-center mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-6 h-6 text-black transform -rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <h1 className="text-xl font-black tracking-tight">Moon Traders</h1>
                    </div>
                    <p className="text-[10px] tracking-widest border-b border-black w-full text-center pb-1 mb-1">PURCHASE ORDER</p>
                    <div className="w-full border-t border-black"></div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-6">
                    <div className="p-1">
                        <div className="w-24 h-24 bg-black/10 flex items-center justify-center border-2 border-black/10">
                            <svg className="w-24 h-24 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 15h6v6H3v-6zm2 2v2h2v-2H5zm13-2h3v2h-3v-2zm-3 2h2v2h-2v-2zm-3 2h2v2h-2v-2zm3 2h3v2h-3v-2zM15 3h2v2h-2V3zm-6 8h2v2H9v-2zm6 0h2v2h-2v-2zm-6 4h2v2H9v-2zm2-2h2v2h-2v-2zm-4 4H5v2h2v-2z" /></svg>
                        </div>
                    </div>
                </div>

                {/* Date / Time / Status */}
                <div className="mb-3 space-y-1.5 font-bold">
                    <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{new Date(data.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Time:</span>
                        <span>{data.time}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Status:</span>
                        <span>RECEIVED</span>
                    </div>
                </div>

                <div className="border-b border-black mb-3"></div>

                {/* Customer Info */}
                <div className="mb-3 space-y-1.5 font-bold">
                    <div className="flex justify-between">
                        <span>Name:</span>
                        <span className="text-right max-w-[65%] truncate">{data.customerName || 'Walk-in'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Contact:</span>
                        <span>{data.orderNumber || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Detail:</span>
                        <span className="text-right max-w-[65%] truncate">-</span>
                    </div>
                </div>

                <div className="border-b border-black mb-1"></div>
                <div className="border-b border-black mb-3"></div>

                {/* Items Table */}
                <table className="w-full mb-3">
                    <thead>
                        <tr className="text-left border-b border-black">
                            <th className="pb-2 w-[35%]">ITEM</th>
                            <th className="pb-2 text-center w-[15%]">QTY</th>
                            <th className="pb-2 text-right w-[20%]">PRICE</th>
                            <th className="pb-2 text-right w-[30%]">AMT</th>
                        </tr>
                    </thead>
                    <tbody className="">
                        {data.items.map((item, idx) => (
                            <tr key={idx} className="align-top">
                                <td className="py-1.5 pr-1 font-bold truncate max-w-[80px]">{item.item.name}</td>
                                <td className="py-1.5 text-center">{item.quantity}</td>
                                <td className="py-1.5 text-right">{item.unitPrice.toFixed(2)}</td>
                                <td className="py-1.5 text-right">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="border-t border-black mb-1"></div>
                <div className="border-t border-black mb-3"></div>

                {/* Totals */}
                <div className="flex justify-between items-center text-sm font-black mb-3">
                    <span>TOTAL</span>
                    <span>PKR {data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="border-b border-black mb-3"></div>

                {/* Notes & Terms */}
                <div className="mb-6 space-y-2 font-bold">
                    <div className="flex justify-between">
                        <span>Notes:</span>
                        <span className="text-right">something</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Terms:</span>
                        <span className="text-right">nothing</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] mb-6 flex items-center justify-center gap-2">
                    <span>- - -</span> <span>END</span> <span>- - -</span>
                </div>

                {/* On-Screen Only Actions */}
                <div className="print:hidden flex flex-col gap-2 mt-4 border-t border-gray-200 pt-4 w-full">
                    <button
                        onClick={() => window.print()}
                        className="w-full bg-black text-white py-3 rounded font-bold hover:bg-gray-800 transition-colors"
                    >
                        Print Receipt
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="w-full bg-gray-200 text-black py-3 rounded font-bold hover:bg-gray-300 transition-colors"
                        >
                            Back
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
