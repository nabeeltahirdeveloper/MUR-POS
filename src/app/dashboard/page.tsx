"use client";

import Link from "next/link";
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
    const [dailySummary, setDailySummary] = useState<any>(null);

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
                    <Link
                        href="/ledger/new"
                        className="block p-6 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-xl shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                                <BanknotesIcon className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Add Entry</h2>
                                <p className="text-sm text-white/80">Record a new transaction</p>
                            </div>
                        </div>
                    </Link>
                </div>

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
