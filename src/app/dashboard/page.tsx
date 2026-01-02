"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { DashboardLayout } from "@/components/layout";
import {
    CubeIcon,
    ChartBarIcon,
    BanknotesIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    BoltIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [dailySummary, setDailySummary] = useState<any>(null);
    const [totalSummary, setTotalSummary] = useState<any>(null);
    const [upcomingUtilities, setUpcomingUtilities] = useState<any[]>([]);
    const [debtSummary, setDebtSummary] = useState<any[]>([]);
    const [showTransactionModal, setShowTransactionModal] = useState(false);

    useEffect(() => {
        if (searchParams.get("select") === "type") {
            setShowTransactionModal(true);
        }
    }, [searchParams]);

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        fetch(`/api/ledger/summary/daily?date=${today}`)
            .then((res) => res.json())
            .then((data) => setDailySummary(data))
            .catch((err) => console.error(err));

        fetch('/api/ledger/summary/total')
            .then((res) => res.json())
            .then((data) => setTotalSummary(data))
            .catch((err) => console.error(err));

        fetch('/api/utilities')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const upcoming = data
                        .filter((u: any) => u.status === 'unpaid')
                        .filter((u: any) => {
                            const d = new Date(u.dueDate);
                            d.setHours(0, 0, 0, 0);
                            const diff = d.getTime() - now.getTime();
                            const days = diff / (1000 * 60 * 60 * 24);
                            return days <= 7; // Overdue or due within 7 days
                        })
                        .slice(0, 5);
                    setUpcomingUtilities(upcoming);
                }
            })
            .catch((err) => console.error(err));
        fetch('/api/debts')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const active = data.filter((d: any) => d.status === 'active').slice(0, 5);
                    setDebtSummary(active);
                }
            })
            .catch((err) => console.error(err));
    }, []);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500">
                        {new Date().toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Today's Credit */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Today's Credit</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">
                                    Rs. {dailySummary?.summary?.totalCredit?.toFixed(2) || "0.00"}
                                </p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <ArrowTrendingUpIcon className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    {/* Today's Debit */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Today's Debit</p>
                                <p className="text-2xl font-bold text-red-600 mt-1">
                                    Rs. {dailySummary?.summary?.totalDebit?.toFixed(2) || "0.00"}
                                </p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-lg">
                                <ArrowTrendingDownIcon className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                    </div>

                    {/* Net Balance */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Balance</p>
                                <p
                                    className={`text-2xl font-bold mt-1 ${(totalSummary?.summary?.net || 0) >= 0
                                        ? "text-blue-600"
                                        : "text-red-600"
                                        }`}
                                >
                                    Rs. {totalSummary?.summary?.net?.toFixed(2) || "0.00"}
                                </p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <BanknotesIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Categories Today</p>
                                <p className="text-2xl font-bold text-purple-600 mt-1">
                                    {dailySummary?.breakdown?.length || 0}
                                </p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <ChartBarIcon className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Inventory Card */}
                    <Link
                        href="/items"
                        className="block p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                <CubeIcon className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Inventory</h2>
                                <p className="text-sm text-gray-500">Manage items and stock levels</p>
                            </div>
                        </div>
                    </Link>

                    {/* Ledger Card */}
                    <Link
                        href="/ledger"
                        className="block p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                                <ChartBarIcon className="h-8 w-8 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Ledger</h2>
                                <p className="text-sm text-gray-500">Track income and expenses</p>
                            </div>
                        </div>
                    </Link>

                    {/* Add Entry Card */}
                    <button
                        onClick={() => setShowTransactionModal(true)}
                        className="block w-full text-left p-6 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-xl shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                                <BanknotesIcon className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Make Bill</h2>
                                <p className="text-sm text-white/80">Record a new transaction</p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Transaction Type Selection Modal */}
                {showTransactionModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-fadeIn scale-100">
                            <div className="p-6 text-center border-b border-gray-100">
                                <h3 className="text-xl font-bold text-gray-900">Select Transaction Type</h3>
                                <p className="text-sm text-gray-500 mt-1">Is money coming in or going out?</p>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => router.push("/ledger/new?type=credit")}
                                    className="flex flex-col items-center justify-center p-6 rounded-xl bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-100 transition-all group"
                                >
                                    <ArrowTrendingUpIcon className="h-10 w-10 text-emerald-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-emerald-700">Cash-In</span>
                                </button>
                                <button
                                    onClick={() => router.push("/ledger/new?type=debit")}
                                    className="flex flex-col items-center justify-center p-6 rounded-xl bg-red-50 border-2 border-red-100 hover:border-red-500 hover:bg-red-100 transition-all group"
                                >
                                    <ArrowTrendingDownIcon className="h-10 w-10 text-red-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-red-700">Cash-Out</span>
                                </button>
                            </div>
                            <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                                <button
                                    onClick={() => setShowTransactionModal(false)}
                                    className="w-full py-3 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 transition-all duration-200 font-bold text-sm uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Upcoming Utilities Widget */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <BoltIcon className="h-5 w-5 text-amber-500" />
                                <h3 className="font-bold text-gray-900">Utilities Bills</h3>
                            </div>
                            <Link
                                href="/utilities"
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                View All →
                            </Link>
                        </div>
                        <div className="flex-1">
                            {upcomingUtilities.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {upcomingUtilities.map((utility) => {
                                        const dueDate = new Date(utility.dueDate);
                                        const isOverdue = dueDate < new Date();
                                        return (
                                            <div
                                                key={utility.id}
                                                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{utility.name}</span>
                                                    <span className={`text-xs ${isOverdue ? "text-red-500 font-semibold" : "text-gray-500"}`}>
                                                        Due: {dueDate.toLocaleDateString()}
                                                        {isOverdue && " (OVERDUE)"}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-gray-900">
                                                        Rs. {utility.amount.toFixed(2)}
                                                    </p>
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                                                        {utility.category || "General"}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                    <div className="p-3 bg-green-50 rounded-full mb-3">
                                        <ArrowTrendingUpIcon className="h-6 w-6 text-green-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium">All caught up!</p>
                                    <p className="text-xs text-gray-400 mt-1">No bills due in the next 7 days.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Loan & Debt Summary Widget */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <BanknotesIcon className="h-5 w-5 text-blue-500" />
                                <h3 className="font-bold text-gray-900">Active Loans</h3>
                            </div>
                            <Link
                                href="/debts"
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                View All →
                            </Link>
                        </div>
                        <div className="flex-1">
                            {debtSummary.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {debtSummary.map((debt) => (
                                        <div
                                            key={debt.id}
                                            className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{debt.personName}</span>
                                                <span className={`text-[10px] uppercase tracking-wider font-bold ${debt.type === 'loaned_out' ? 'text-blue-500' : 'text-purple-500'
                                                    }`}>
                                                    {debt.type === 'loaned_out' ? 'Loan-Out' : 'Loan-In'}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-gray-900">
                                                    Rs. {debt.amount.toLocaleString()}
                                                </p>
                                                {debt.dueDate && (
                                                    <p className="text-[10px] text-gray-400">
                                                        Due: {new Date(debt.dueDate).toLocaleDateString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                    <div className="p-3 bg-blue-50 rounded-full mb-3">
                                        <CheckCircleIcon className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium">Clear Records</p>
                                    <p className="text-xs text-gray-400 mt-1">No active loans or debts found.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Category Breakdown */}
                    {dailySummary?.breakdown && dailySummary.breakdown.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <h3 className="font-bold text-gray-900">Today's Category Breakdown</h3>
                                <Link
                                    href="/ledger/summary/daily"
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    View Details →
                                </Link>
                            </div>
                            <div className="divide-y divide-gray-100 flex-1">
                                {dailySummary.breakdown.map((cat: any) => (
                                    <div
                                        key={cat.name}
                                        className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors"
                                    >
                                        <span className="font-bold text-gray-700">{cat.name}</span>
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="flex flex-col items-end">
                                                <span className="text-green-600 font-medium">+Rs. {cat.credit.toFixed(2)}</span>
                                                <span className="text-red-400">-Rs. {cat.debit.toFixed(2)}</span>
                                            </div>
                                            <span
                                                className={`font-bold px-3 py-1 rounded-lg ${cat.credit - cat.debit >= 0
                                                    ? "bg-blue-50 text-blue-600"
                                                    : "bg-red-50 text-red-600"
                                                    }`}
                                            >
                                                Rs. {(cat.credit - cat.debit).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
