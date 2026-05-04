"use client";

import { useEffect, useState } from "react";
import {
    CalendarIcon,
    TagIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ArrowPathIcon,
    LockClosedIcon
} from "@heroicons/react/24/outline";
import { useLock } from "@/contexts/LockContext";

export default function ReportsSection() {
    const { isLocked } = useLock();
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
                const processedOrderNumbers = new Set<string>();

                // Calculate category breakdown
                const breakdownMap: Record<string, {
                    name: string, credit: number, debit: number
                }> = {};

                data.forEach((entry: any) => {
                    const totalAmount = Number(entry.amount);

                    // Deduplication logic for batch orders
                    const orderNum = entry.orderNumber ? String(entry.orderNumber) : null;
                    const isDuplicateOrder = orderNum && processedOrderNumbers.has(orderNum);

                    // Parse actual cash moved from note
                    let cashMoved = 0;
                    let hasAdvanceOrPayment = false;
                    let hasRemaining = false;
                    let remainingValue = 0;

                    if (entry.note) {
                        const lines = entry.note.split('\n');
                        for (const line of lines) {
                            const trimmed = line.trim();

                            // Robust regex check
                            const advMatch = trimmed.match(/^(Advance|Payment|Paid):\s*(\d+(\.\d+)?)/i);
                            if (advMatch) {
                                cashMoved = Number(advMatch[2]) || 0;
                                hasAdvanceOrPayment = true;
                                break;
                            }

                            const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
                            if (remMatch) {
                                hasRemaining = true;
                                remainingValue = Number(remMatch[1]) || 0;
                            }
                        }
                    }

                    // Fallback
                    if (!hasAdvanceOrPayment) {
                        if (!hasRemaining || remainingValue === 0) {
                            cashMoved = totalAmount;
                        } else {
                            cashMoved = 0;
                        }
                    }

                    // Count only actual cash moved
                    // If it's a duplicate order, we skip adding cashMoved to the totals
                    let entryCredit = 0;
                    let entryDebit = 0;

                    if (!isDuplicateOrder) {
                        entryCredit = entry.type === 'credit' ? cashMoved : 0;
                        entryDebit = entry.type === 'debit' ? cashMoved : 0;
                        if (orderNum) processedOrderNumbers.add(orderNum);
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

    if (isLocked) return null;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 sm:p-8">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
                            <CalendarIcon className="h-6 w-6 text-primary" />
                            Reports & Analysis
                        </h3>
                        <p className="text-sm font-medium text-gray-500 mt-1">Analyze your ledger data across date ranges and categories</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end gap-3 w-full xl:w-auto">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">From Date</label>
                            <input
                                type="date"
                                className="w-full text-sm font-bold border border-gray-100 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 transition-all"
                                value={filters.from}
                                onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">To Date</label>
                            <input
                                type="date"
                                className="w-full text-sm font-bold border border-gray-100 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 transition-all"
                                value={filters.to}
                                onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Category</label>
                            <select
                                className="w-full text-sm font-bold border border-gray-100 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 transition-all"
                                value={filters.categoryId}
                                onChange={(e) => setFilters(f => ({ ...f, categoryId: e.target.value }))}
                            >
                                <option value="">All Categories</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={fetchData}
                                className="flex-1 lg:flex-none p-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-400 hover:text-primary hover:bg-white hover:border-primary transition-all flex items-center justify-center shadow-sm"
                                title="Refresh Report"
                            >
                                <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                                <span className="ml-2 font-bold text-xs uppercase tracking-widest lg:hidden">Sync Data</span>
                            </button>
                        </div>
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
                        <p className={`text-xs font-bold ${summary.net >= 0 ? 'text-primary' : 'text-red-600'} uppercase tracking-widest`}>
                            Net Balance {summary.net >= 0 ? '(Profit)' : '(Loss)'}
                        </p>
                        <p className={`text-2xl font-black ${summary.net >= 0 ? 'text-primary-dark' : 'text-red-700'} mt-1`}>Rs. {Math.abs(summary.net).toLocaleString()}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2 px-2">
                        <TagIcon className="h-4 w-4 text-primary" />
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
