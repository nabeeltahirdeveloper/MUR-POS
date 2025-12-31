"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import {
    CubeIcon,
    ChartBarIcon,
    BanknotesIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";

export default function DashboardPage() {
    const router = useRouter(); // Initialize router
    const [dailySummary, setDailySummary] = useState<any>(null);
    const [showTransactionModal, setShowTransactionModal] = useState(false);

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        fetch(`/api/ledger/summary/daily?date=${today}`)
            .then((res) => res.json())
            .then((data) => setDailySummary(data))
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
                                    {dailySummary?.summary?.totalCredit?.toFixed(2) || "0.00"}
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
                                    {dailySummary?.summary?.totalDebit?.toFixed(2) || "0.00"}
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
                                <p className="text-sm font-medium text-gray-500">Net Balance</p>
                                <p
                                    className={`text-2xl font-bold mt-1 ${(dailySummary?.summary?.net || 0) >= 0
                                        ? "text-blue-600"
                                        : "text-red-600"
                                        }`}
                                >
                                    {dailySummary?.summary?.net?.toFixed(2) || "0.00"}
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
                                    <span className="font-bold text-emerald-700">Cash (In)</span>
                                </button>
                                <button
                                    onClick={() => router.push("/ledger/new?type=debit")}
                                    className="flex flex-col items-center justify-center p-6 rounded-xl bg-red-50 border-2 border-red-100 hover:border-red-500 hover:bg-red-100 transition-all group"
                                >
                                    <ArrowTrendingDownIcon className="h-10 w-10 text-red-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-red-700">Cash (Out)</span>
                                </button>
                            </div>
                            <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                                <button
                                    onClick={() => setShowTransactionModal(false)}
                                    className="w-full py-3 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 transition-all duration-200 font-bold text-sm uppercase tracking-widest active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Breakdown */}
                {dailySummary?.breakdown && dailySummary.breakdown.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">Today's Category Breakdown</h3>
                            <Link
                                href="/ledger/summary/daily"
                                className="text-sm text-blue-600 hover:underline"
                            >
                                View Details →
                            </Link>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {dailySummary.breakdown.map((cat: any) => (
                                <div
                                    key={cat.name}
                                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                                >
                                    <span className="font-medium text-gray-700">{cat.name}</span>
                                    <div className="flex items-center gap-6 text-sm">
                                        <span className="text-green-600">+{cat.credit.toFixed(2)}</span>
                                        <span className="text-red-500">-{cat.debit.toFixed(2)}</span>
                                        <span
                                            className={`font-medium ${cat.credit - cat.debit >= 0
                                                ? "text-blue-600"
                                                : "text-red-600"
                                                }`}
                                        >
                                            Net: {(cat.credit - cat.debit).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
