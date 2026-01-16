"use client";

import { useEffect, useState } from "react";
import {
    CalendarIcon,
    TagIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ArrowPathIcon
} from "@heroicons/react/24/outline";

export default function ReportsSection() {
    const [entries, setEntries] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0], // Start of current month
        to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0], // End of current month
        categoryId: "",
    });
    const [summary, setSummary] = useState({ credit: 0, debit: 0, net: 0 });
    const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/ledger/categories");
            if (res.ok) setCategories(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (filters.from) query.append("from", filters.from);
            if (filters.to) query.append("to", filters.to);
            if (filters.categoryId) query.append("categoryId", filters.categoryId);
            query.append("limit", "1000"); // Fetch more for reporting

            const res = await fetch(`/api/ledger?${query.toString()}`);
            if (res.ok) {
                const result = await res.json();
                const data = result.data || [];
                setEntries(data);

                // Calculate summary
                let credit = 0;
                let debit = 0;
                const processedOrders = new Set<string>();

                // Calculate category breakdown
                const breakdownMap: Record<string, {
                    name: string, credit: number, debit: number
                }> = {};

                data.forEach((entry: any) => {
                    let entryCredit = entry.type === 'credit' ? entry.amount : 0;
                    let entryDebit = entry.type === 'debit' ? entry.amount : 0;

                    // Parse Remaining Amount
                    let remaining = 0;
                    if (entry.note) {
                        const match = entry.note.match(/Remaining: (\d+)/);
                        if (match) remaining = Number(match[1]);
                    }

                    // Apply Virtual Adjustment for Pending Amounts
                    if (remaining > 0) {
                        // Generate key for deduplication (simple version for client-side)
                        const orderMatch = entry.note?.match(/Order #(\d+)/);
                        const orderKey = orderMatch ? `ORD-${orderMatch[1]}` : `DATE-${entry.date}-AMT-${entry.amount}`;

                        // Only apply if we haven't processed this remaining amount (fairly naive dedup for now)
                        if (!processedOrders.has(orderKey)) {
                            processedOrders.add(orderKey);
                            if (entry.type === 'credit') {
                                // Sale with Pending: Treat as Virtual Debit to reduce Net
                                entryDebit += remaining;
                            } else {
                                // Purchase with Pending: Treat as Virtual Credit to reduce Net Cost
                                entryCredit += remaining;
                            }
                        }
                    }

                    credit += entryCredit;
                    debit += entryDebit;

                    // Category Breakdown
                    const catName = entry.category?.name || "Uncategorized";
                    if (!breakdownMap[catName]) {
                        breakdownMap[catName] = { name: catName, credit: 0, debit: 0 };
                    }
                    breakdownMap[catName].credit += entryCredit;
                    breakdownMap[catName].debit += entryDebit;
                });

                setSummary({ credit, debit, net: credit - debit });
                setCategoryBreakdown(Object.values(breakdownMap).sort((a, b) => (b.credit - b.debit) - (a.credit - a.debit)));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-primary" />
                            Reports & Analysis
                        </h3>
                        <p className="text-sm text-gray-500">Analyze your ledger data across date ranges and categories</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">From:</span>
                            <input
                                type="date"
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-primary outline-none text-gray-900"
                                value={filters.from}
                                onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">To:</span>
                            <input
                                type="date"
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-primary outline-none text-gray-900"
                                value={filters.to}
                                onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">Category:</span>
                            <select
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-primary outline-none text-gray-900"
                                value={filters.categoryId}
                                onChange={(e) => setFilters(f => ({ ...f, categoryId: e.target.value }))}
                            >
                                <option value="">All Categories</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={fetchData}
                            className="p-2 text-gray-400 hover:text-primary transition-colors"
                        >
                            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                        <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Total Cash-In</p>
                        <p className="text-2xl font-black text-green-700 mt-1">Rs. {summary.credit.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                        <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Total Cash-Out</p>
                        <p className="text-2xl font-black text-red-700 mt-1">Rs. {summary.debit.toLocaleString()}</p>
                    </div>
                    <div className={`${summary.net >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-red-50 border-red-100'} p-4 rounded-xl border`}>
                        <p className={`text-xs font-bold ${summary.net >= 0 ? 'text-primary' : 'text-red-600'} uppercase tracking-widest`}>Net Balance</p>
                        <p className={`text-2xl font-black ${summary.net >= 0 ? 'text-primary-dark' : 'text-red-700'} mt-1`}>Rs. {summary.net.toLocaleString()}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2 px-2">
                        <TagIcon className="h-4 w-4 text-purple-500" />
                        Category Breakdown
                    </h4>
                    {categoryBreakdown.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categoryBreakdown.map((cat) => (
                                <div key={cat.name} className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-primary/20 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-gray-900">{cat.name}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cat.credit - cat.debit >= 0 ? 'bg-primary/10 text-primary-dark' : 'bg-red-100 text-red-700'}`}>
                                            {((cat.credit - cat.debit) / (summary.credit + summary.debit || 1) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Cash-In:</span>
                                            <span className="font-mono text-green-600 font-bold">Rs. {cat.credit.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Cash-Out:</span>
                                            <span className="font-mono text-red-600 font-bold">Rs. {cat.debit.toLocaleString()}</span>
                                        </div>
                                        <div className="pt-2 border-t border-gray-200 mt-2 flex justify-between">
                                            <span className="text-xs font-bold text-gray-700">Net:</span>
                                            <span className={`font-mono text-sm font-black ${cat.credit - cat.debit >= 0 ? 'text-primary' : 'text-red-600'}`}>
                                                Rs. {(cat.credit - cat.debit).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-400 font-medium">No data available for this range</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
