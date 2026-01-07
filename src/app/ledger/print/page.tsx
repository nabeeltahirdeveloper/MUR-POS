"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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
            const res = await fetch("/api/ledger/customers");
            if (res.ok) {
                const data = await res.json();
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

    const formatCurrency = (value: number | string) => {
        const num = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return currency.position === "prefix" ? `${currency.symbol} ${num}` : `${num} ${currency.symbol}`;
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
        <div className="bg-white min-h-screen text-black p-8 print:p-0 font-sans">
            {/* Header */}
            <div className="mb-6 border-b-2 border-gray-800 pb-4">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tight mb-1">
                            {view === 'customers' ? 'Customer Accounts' : 'Ledger Report'}
                        </h1>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">
                            Generated on {new Date().toLocaleString()}
                        </p>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="print:hidden bg-gray-900 text-white px-6 py-2.5 rounded-lg shadow-lg hover:bg-gray-800 transition-all font-bold flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print Report
                    </button>
                </div>

                {view !== 'customers' && (
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Date Range</span>
                            <span className="font-semibold text-gray-900">{filters.from || "Start"} — {filters.to || "End"}</span>
                        </div>
                        {filters.type && (
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Type</span>
                                <span className="font-semibold text-gray-900">{filters.type === 'credit' ? 'Cash-In' : 'Cash-Out'}</span>
                            </div>
                        )}
                        {filters.ids && (
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Selection</span>
                                <span className="font-semibold text-gray-900">{filters.ids.split(',').length} items selected</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500 italic">Preparing report...</div>
            ) : (
                <>
                    {view === 'customers' ? (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-200">
                                    <th className="py-3 pl-2 font-bold uppercase text-xs tracking-wider text-gray-500 w-1/4">Customer Name</th>
                                    <th className="py-3 font-bold uppercase text-xs tracking-wider text-gray-500 w-1/4">Last Transaction</th>
                                    <th className="py-3 font-bold uppercase text-xs tracking-wider text-right text-gray-500">Total Cash-In</th>
                                    <th className="py-3 font-bold uppercase text-xs tracking-wider text-right text-gray-500">Total Cash-Out</th>
                                    <th className="py-3 pr-2 font-bold uppercase text-xs tracking-wider text-right text-gray-500">Net Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {customers.map((c: any, index) => (
                                    <tr key={index} className="break-inside-avoid hover:bg-gray-50">
                                        <td className="py-3 pl-2 text-gray-900 font-bold">{c.name}</td>
                                        <td className="py-3 text-gray-600">{c.lastEntryDate ? new Date(c.lastEntryDate).toLocaleDateString() : '-'}</td>
                                        <td className="py-3 text-right text-emerald-700 font-medium tabular-nums">{formatCurrency(c.totalCredit)}</td>
                                        <td className="py-3 text-right text-rose-700 font-medium tabular-nums">{formatCurrency(c.totalDebit)}</td>
                                        <td className={`py-3 pr-2 text-right font-bold tabular-nums ${c.balance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                            {formatCurrency(c.balance)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-200">
                                    <th className="py-3 pl-2 font-bold uppercase text-xs tracking-wider text-gray-500 w-24">Date</th>
                                    <th className="py-3 font-bold uppercase text-xs tracking-wider text-gray-500 w-1/4">Name / Title</th>
                                    <th className="py-3 font-bold uppercase text-xs tracking-wider text-gray-500">Description</th>
                                    <th className="py-3 font-bold uppercase text-xs tracking-wider text-right text-gray-500 w-32">Cash-In</th>
                                    <th className="py-3 pr-2 font-bold uppercase text-xs tracking-wider text-right text-gray-500 w-32">Cash-Out</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {entries.map((entry: any) => {
                                    const { title, itemName } = parseTransactionNote(entry.note);
                                    return (
                                        <tr key={entry.id} className="break-inside-avoid hover:bg-gray-50">
                                            <td className="py-3 pl-2 align-top text-gray-500 font-medium tabular-nums">
                                                {new Date(entry.date).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 align-top font-bold text-gray-900">
                                                {title}
                                            </td>
                                            <td className="py-3 align-top text-gray-700">
                                                {itemName}
                                                {entry.category && (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-widest border border-gray-200">
                                                        {entry.category.name}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 align-top text-right text-emerald-700 font-medium tabular-nums">
                                                {entry.type === 'credit' ? formatCurrency(entry.amount) : '-'}
                                            </td>
                                            <td className="py-3 pr-2 align-top text-right text-rose-700 font-medium tabular-nums">
                                                {entry.type === 'debit' ? formatCurrency(entry.amount) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-800 bg-gray-50/50">
                                <tr>
                                    <td colSpan={3} className="py-4 pl-2 text-right pr-6 text-xs font-bold uppercase tracking-wider text-gray-500">Totals</td>
                                    <td className="py-4 text-right text-emerald-700 font-bold tabular-nums">{formatCurrency(totalCashIn)}</td>
                                    <td className="py-4 pr-2 text-right text-rose-700 font-bold tabular-nums">{formatCurrency(totalCashOut)}</td>
                                </tr>
                                <tr className="border-t border-gray-200">
                                    <td colSpan={3} className="py-4 pl-2 text-right pr-6 text-xs font-bold uppercase tracking-wider text-gray-500">Net Balance</td>
                                    <td colSpan={2} className={`py-4 pr-2 text-right text-xl font-black tabular-nums ${balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {formatCurrency(balance)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </>
            )}
        </div>
    );
}

export default function LedgerPrintPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LedgerPrintContent />
        </Suspense>
    );
}
