"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { RECEIPT_LOGO_BASE64 } from "@/components/ledger/ReceiptLogoBase64";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function LedgerPrintContent() {
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState({ symbol: "Rs.", position: "prefix" });

    const view = searchParams.get("view") || "entries";

    // Reconstruct filters from URL
    const filters = {
        ids: searchParams.get("ids") || "",
        search: searchParams.get("search") || "",
        type: searchParams.get("type") || "",
        categoryId: searchParams.get("categoryId") || "",
        from: searchParams.get("from") || "",
        to: searchParams.get("to") || "",
    };

    useEffect(() => {
        fetchSettings();
        if (view === "customers") {
            fetchCustomers();
        } else {
            fetchEntries();
        }
    }, [searchParams, view]);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                if (data?.currency) {
                    setCurrency(data.currency);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (filters.from) query.append("from", filters.from);
            if (filters.to) query.append("to", filters.to);

            const res = await fetch(`/api/ledger/customers?${query.toString()}`);
            if (res.ok) {
                let data = await res.json();

                // Client-side search for name
                if (filters.search) {
                    const term = filters.search.toLowerCase();
                    data = data.filter((c: any) => c.name.toLowerCase().includes(term));
                }

                setCustomers(data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();

            if (filters.ids) {
                query.append("limit", "1000");
            } else {
                if (filters.search) query.append("search", filters.search);
                if (filters.type) query.append("type", filters.type);
                if (filters.categoryId) query.append("categoryId", filters.categoryId);
                if (filters.from) query.append("from", filters.from);
                if (filters.to) query.append("to", filters.to);
                query.append("limit", "1000");
            }

            const res = await fetch(`/api/ledger?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                let fetchedEntries = data.data || [];

                // Client-side filter for IDs if provided
                if (filters.ids) {
                    const idList = filters.ids.split(',').map(id => String(id));
                    fetchedEntries = fetchedEntries.filter((e: any) => idList.includes(String(e.id)));
                }

                setEntries(fetchedEntries);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate totals for Entries View
    const totalCashIn = entries
        .filter((e: any) => e.type === 'credit')
        .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

    const totalCashOut = entries
        .filter((e: any) => e.type === 'debit')
        .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

    const balance = totalCashIn - totalCashOut;


    // Helper to parse notes
    const parseTransactionNote = (note: string | null) => {
        if (!note) return { itemName: "-", title: "-" };

        let title = "-";
        let itemName = note;

        if (note.match(/^(?:Order #|Customer: |Supplier: |Item: )/)) {
            const lines = note.split('\n');
            const itemLine = lines.find(l => l.startsWith("Item: "));
            const nameLine = lines.find(l => l.startsWith("Customer: ") || l.startsWith("Supplier: "));

            if (itemLine) {
                const match = itemLine.match(/Item:\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*\(Qty:/);
                if (match) itemName = match[2].trim();
                else itemName = itemLine.replace("Item: ", "");
            }
            if (nameLine) title = nameLine.replace(/^(Customer|Supplier): /, "");
        }
        else if (note.startsWith("[Loan]") || note.startsWith("[Payment]")) {
            const parts = note.split(":");
            title = parts[0];
            itemName = parts[1] || "-";
        }
        else if (note.startsWith("[Bill]")) {
            itemName = note;
        }

        return {
            title: title !== "-" ? title : "-",
            itemName: itemName
        };
    };

    return (
        <div className="bg-white min-h-screen text-black font-sans font-bold text-sm leading-snug p-2 print:p-0">
            {/* Thermal Receipt Container - 80mm ~ 300px */}
            {/* Added px-2 padding to container to prevent edge clipping */}
            <div className="report-container max-w-[80mm] mx-auto print:w-full print:max-w-none px-1">
                <style jsx global>{`
                    @media print {
                        @page { margin: 0; size: auto; }
                        body { margin: 0; padding: 0; }
                        /* Hide app chrome in print preview */
                        header, nav, aside, .sidebar, .topbar, .header, .search, .toggle, .bell, .app-header, .AppHeader, .site-header { display: none !important; visibility: hidden !important; }
                        
                        .report-container {
                            margin-top: -60px !important;
                            overflow: visible !important;
                        }

                        /* Receipt specific optimizations */
                        .receipt-logo {
                            width: 100%;
                            max-width: 250px;
                            height: auto;
                            display: block;
                            margin: 0 auto -20px auto;
                            image-rendering: pixelated;
                            filter: contrast(160%);
                            position: relative !important;
                        }
                        .receipt-title {
                            margin-top: -20px !important;
                            position: relative !important;
                            z-index: 10 !important;
                        }
                    }
                `}</style>

                {/* Header */}
                <div className="text-center mb-1">
                    {/* Logo */}
                    <img
                        src={RECEIPT_LOGO_BASE64}
                        alt="Moon Traders"
                        className="receipt-logo"
                    />
                    <h1 className="text-xl font-black uppercase tracking-tight break-words mt-[-50px] relative z-50 receipt-title">
                        {view === 'customers' ? 'CUS. LIST' : 'LEDGER RPT'}
                    </h1>
                    <p className="text-xs font-bold text-black break-words relative z-50">
                        {new Date().toLocaleString()}
                    </p>
                    {filters.from && filters.to && (
                        <p className="text-xs font-bold mt-1 text-black break-words relative z-50">
                            {new Date(filters.from).toLocaleDateString()} - {new Date(filters.to).toLocaleDateString()}
                        </p>
                    )}
                </div>
                <div className="border-b-2 border-black border-dashed relative z-50 mb-3"></div>

                {loading ? (
                    <div className="flex justify-center py-4 font-bold"><LoadingSpinner /></div>
                ) : (
                    <>
                        {view === 'customers' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-12 font-black border-b-2 border-black pb-2 mb-2 text-xs uppercase tracking-wider">
                                    <div className="col-span-12 mb-1">Name / Last Tx</div>
                                    <div className="col-span-6 text-left">In/Out</div>
                                    <div className="col-span-6 text-right">Balance</div>
                                </div>
                                {customers.map((c: any, index) => (
                                    <div key={index} className="flex flex-col py-2 border-b border-black border-dashed">
                                        <div className="font-black text-sm mb-1 break-words whitespace-normal leading-tight">
                                            {c.name}
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-xs font-bold">
                                                <div>+{Math.round(c.totalCredit).toLocaleString()}</div>
                                                <div>-{Math.round(c.totalDebit).toLocaleString()}</div>
                                            </div>
                                            <div className="text-base font-black text-right">
                                                {Math.round(c.balance).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Entries List */}
                                <div>
                                    <div className="grid grid-cols-12 font-black border-b-2 border-black pb-2 mb-2 text-xs uppercase tracking-wider">
                                        <div className="col-span-4">Date</div>
                                        <div className="col-span-8 text-right">Amount</div>
                                    </div>

                                    {entries.map((entry: any) => {
                                        const { title, itemName } = parseTransactionNote(entry.note);
                                        const isCredit = entry.type === 'credit';
                                        return (
                                            <div key={entry.id} className="mb-3 border-b border-black border-dashed pb-2 last:border-0">
                                                <div className="flex justify-between font-black text-sm mb-1 items-start">
                                                    <span className="whitespace-nowrap mr-2">{new Date(entry.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}</span>
                                                    <span className="text-right flex-1 break-words">
                                                        {isCredit ? "+" : "-"} {Number(entry.amount).toLocaleString()}
                                                    </span>
                                                </div>
                                                {/* Ensure full text wrapping with break-words and whitespace-normal */}
                                                <div className="text-xs font-bold uppercase mb-0.5 text-black break-words whitespace-normal leading-tight">
                                                    {title}
                                                </div>
                                                <div className="text-xs font-bold text-black break-words whitespace-normal leading-tight text-gray-800">
                                                    {itemName}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Footer / Totals */}
                                <div className="border-t-2 border-black border-dashed pt-4 mt-2">
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span>TOTAL IN:</span>
                                        <span>{totalCashIn.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span>TOTAL OUT:</span>
                                        <span>{totalCashOut.toLocaleString()}</span>
                                    </div>
                                    {/* Removed negative margins and background to prevent overflow printing issues */}
                                    <div className="flex justify-between text-lg font-black mt-2 border-t-4 border-black pt-2 text-black">
                                        <span>NET:</span>
                                        <span>{balance.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Print Button - Hidden on Print */}
                <div className="print:hidden mt-8 text-center">
                    <button
                        onClick={() => window.print()}
                        className="bg-black text-white px-8 py-3 rounded-full font-black text-base shadow-xl hover:scale-105 transition-transform"
                    >
                        PRINT (80MM)
                    </button>
                    <p className="text-xs font-bold text-gray-500 mt-4 max-w-[200px] mx-auto">
                        High Contrast Mode Enabled. Select 80mm paper.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LedgerPrintPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>}>
            <LedgerPrintContent />
        </Suspense>
    );
}
