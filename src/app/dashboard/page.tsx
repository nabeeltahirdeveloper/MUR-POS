"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import useSWR from "swr";
import { DashboardLayout } from "@/components/layout";
import { useLock } from "@/contexts/LockContext";
import {
    CubeIcon,
    ChartBarIcon,
    BanknotesIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    BoltIcon,
    CheckCircleIcon,
    RectangleGroupIcon,
    LockClosedIcon,
    ArrowPathIcon,
} from "@heroicons/react/24/outline";
import PendingCustomOrders from "@/components/dashboard/PendingCustomOrders";
import LowStockWidget from "@/components/dashboard/LowStockWidget";
import StockValueWidget from "@/components/dashboard/StockValueWidget";
import ReportsSection from "@/components/dashboard/ReportsSection";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isLocked } = useLock();
    const [dailySummary, setDailySummary] = useState<any>(null);
    const [totalSummary, setTotalSummary] = useState<any>(null);
    const [upcomingUtilities, setUpcomingUtilities] = useState<any[]>([]);
    const [upcomingExpenses, setUpcomingExpenses] = useState<any[]>([]);
    const [debtSummary, setDebtSummary] = useState<any[]>([]);
    const [pendingLedger, setPendingLedger] = useState<any[]>([]);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [currency, setCurrency] = useState({ symbol: "Rs.", position: "prefix" });

    const fetcher = (url: string) => fetch(url).then(res => res.json());

    const todayStr = new Date().toISOString().split("T")[0];
    const [refreshing, setRefreshing] = useState(false);
    const { data: overviewData, mutate: refreshDashboard } = useSWR(
        () => `/api/dashboard/overview?date=${todayStr}`,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        }
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await refreshDashboard();
        setRefreshing(false);
    };

    useEffect(() => {
        if (!overviewData) return;
        
        if (overviewData.currency) setCurrency(overviewData.currency);
        if (overviewData.dailySummary) setDailySummary(overviewData.dailySummary);
        if (overviewData.totalSummary) setTotalSummary(overviewData.totalSummary);
        if (Array.isArray(overviewData.upcomingUtilities)) setUpcomingUtilities(overviewData.upcomingUtilities);
        if (Array.isArray(overviewData.upcomingExpenses)) setUpcomingExpenses(overviewData.upcomingExpenses);
        if (Array.isArray(overviewData.debtSummary)) setDebtSummary(overviewData.debtSummary);
        if (Array.isArray(overviewData.pendingLedger)) setPendingLedger(overviewData.pendingLedger);
    }, [overviewData]);

    const formatCurr = (val: number | string) => {
        const num = Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 });
        return currency.position === "prefix" ? `${currency.symbol} ${num}` : `${num} ${currency.symbol}`;
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
                        <p className="text-sm font-medium text-gray-500">
                            Overview of your business performance
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-all"
                            title="Refresh Dashboard"
                        >
                            <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="bg-white border border-gray-100 px-4 py-2 rounded-xl shadow-sm">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today</p>
                            <p className="text-sm font-bold text-gray-900">
                                {new Date().toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StockValueWidget />

                    {/* Ledger Summary Widget */}
                    {!isLocked && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Summary</p>
                                    <p className="text-2xl font-black text-primary">
                                        Net: {formatCurr(totalSummary?.summary?.net || 0)}
                                    </p>
                                </div>
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <RectangleGroupIcon className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-green-600">Cash-In</span>
                                        <span className="text-red-500">Cash-Out</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${(totalSummary?.summary?.totalCredit / (totalSummary?.summary?.totalCredit + totalSummary?.summary?.totalDebit || 1)) * 100}%` }}
                                        ></div>
                                        <div
                                            className="h-full bg-red-500"
                                            style={{ width: `${(totalSummary?.summary?.totalDebit / (totalSummary?.summary?.totalCredit + totalSummary?.summary?.totalDebit || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 font-medium">Out of</p>
                                    <p className="text-sm font-bold text-gray-900">{formatCurr(totalSummary?.summary?.totalCredit + totalSummary?.summary?.totalDebit || 0)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Access to Ledger */}
                    {!isLocked && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
                            <Link href="/ledger" className="flex items-center justify-between group">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 group-hover:text-gray-900 transition-colors">Go to Detailed</p>
                                    <p className="text-lg font-bold text-gray-900">Full Records →</p>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
                                    <ChartBarIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-700" />
                                </div>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Quick Actions Component */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Link
                        href="/items"
                        className="block p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/20 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-gray-200 transition-colors">
                                <CubeIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 leading-tight">Inventory</h2>
                                <p className="text-xs text-gray-500">Track stock & prices</p>
                            </div>
                        </div>
                    </Link>

                    <button
                        onClick={() => setShowTransactionModal(true)}
                        className="block w-full text-left p-5 bg-primary rounded-xl shadow-sm hover:shadow-md hover:bg-primary-dark transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                                <BanknotesIcon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white leading-tight">Create Bill</h2>
                                <p className="text-xs text-white/70">Sales or expenses</p>
                            </div>
                        </div>
                    </button>

                    <Link
                        href="/utilities"
                        className="block p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/20 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-gray-200 transition-colors">
                                <BoltIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 leading-tight">Utilities</h2>
                                <p className="text-xs text-gray-500">Upcoming payments</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/other-expenses"
                        className="block p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/20 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-gray-200 transition-colors">
                                <BanknotesIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 leading-tight">Expenses</h2>
                                <p className="text-xs text-gray-500">Manage other costs</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Secondary Widgets Row */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Pending Custom Orders */}
                    <div className="lg:col-span-1">
                        <PendingCustomOrders />
                    </div>

                    {/* Pending Utilities Widget */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <BoltIcon className="h-5 w-5 text-primary" />
                                <h3 className="font-bold text-gray-900">Utilities</h3>
                            </div>
                            <Link href="/utilities" className="text-xs font-bold text-primary hover:underline">View All</Link>
                        </div>
                        <div className="flex-1">
                            {upcomingUtilities.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {upcomingUtilities.map((utility) => {
                                        const dueDate = new Date(utility.dueDate);
                                        const isOverdue = dueDate < new Date();
                                        return (
                                            <div key={utility.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{utility.name}</span>
                                                    <span className={`text-[10px] font-bold ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                                                        Due: {dueDate.toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-gray-900">{formatCurr(utility.amount)}</p>
                                                    <p className="text-[9px] uppercase tracking-wider font-black text-gray-300">{utility.category || "General"}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                                    <div className="p-2 bg-green-50 rounded-full mb-2">
                                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-500">No Pending Bills</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pending Expenses Widget */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <BanknotesIcon className="h-5 w-5 text-primary" />
                                <h3 className="font-bold text-gray-900">Expenses</h3>
                            </div>
                            <Link href="/other-expenses" className="text-xs font-bold text-primary hover:underline">View All</Link>
                        </div>
                        <div className="flex-1">
                            {upcomingExpenses.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {upcomingExpenses.map((expense) => {
                                        const dueDate = new Date(expense.dueDate);
                                        const isOverdue = dueDate < new Date();
                                        return (
                                            <div key={expense.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{expense.name}</span>
                                                    <span className={`text-[10px] font-bold ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                                                        Due: {dueDate.toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-gray-900">{formatCurr(expense.amount)}</p>
                                                    <p className="text-[9px] uppercase tracking-wider font-black text-gray-300">{expense.category || "General"}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                                    <div className="p-2 bg-green-50 rounded-full mb-2">
                                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-500">No Pending Expenses</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pending Payments (Ledger Remaining) Widget */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-gray-100 rounded-lg">
                                    <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h3 className="font-bold text-gray-900">Payments</h3>
                            </div>
                            <Link href="/ledger?view=pending" className="text-xs font-bold text-primary-dark hover:underline">View All</Link>
                        </div>
                        <div className="flex-1">
                            {pendingLedger.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {pendingLedger.map((entry) => (
                                        <div key={entry.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{entry.personName}</span>
                                                <span className="text-[10px] font-bold text-gray-400">
                                                    {new Date(entry.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-red-600">{formatCurr(entry.remaining)}</p>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${entry.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {entry.type === 'credit' ? 'Receive' : 'Pay'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                                    <div className="p-3 bg-gray-100 rounded-full mb-3">
                                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <p className="text-sm font-bold text-gray-500 mb-1">No Payments</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Third Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Low Stock Items */}
                    <div className="lg:col-span-1">
                        <LowStockWidget />
                    </div>

                    {/* Pending Debts Widget */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <BanknotesIcon className="h-5 w-5 text-primary" />
                                <h3 className="font-bold text-gray-900">Pending Loans</h3>
                            </div>
                            <Link href="/debts" className="text-xs font-bold text-primary hover:underline">View All</Link>
                        </div>
                        <div className="flex-1">
                            {debtSummary.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {debtSummary.map((debt) => (
                                        <div key={debt.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{debt.personName}</span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block w-fit mt-1 ${debt.type === 'loaned_out' ? 'bg-primary/10 text-primary-dark' : 'bg-primary/10 text-primary'}`}>
                                                    {debt.type === 'loaned_out' ? 'Loan-Out' : 'Loan-In'}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-gray-900">{formatCurr(debt.amount)}</p>
                                                {debt.dueDate && <p className="text-[10px] font-bold text-gray-400">{new Date(debt.dueDate).toLocaleDateString()}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                                    <div className="p-2 bg-primary/10 rounded-full mb-2">
                                        <CheckCircleIcon className="h-5 w-5 text-primary" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-500">No Active Debts</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reports Section */}
                <ReportsSection />

                {/* Transaction Type Selection Modal */}
                {showTransactionModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                            <div className="p-8 text-center border-b border-gray-100">
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Record Transaction</h3>
                                <p className="text-sm font-medium text-gray-500 mt-2">Choose the type of entry you want to make</p>
                            </div>
                            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <button
                                    onClick={() => router.push("/ledger/new?type=credit")}
                                    className="flex flex-col items-center justify-center p-8 rounded-2xl bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-100 transition-all group"
                                >
                                    <div className="p-4 bg-emerald-100 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                        <ArrowTrendingUpIcon className="h-8 w-8 text-emerald-600" />
                                    </div>
                                    <span className="font-black text-emerald-800 text-lg">Cash-In</span>
                                    <span className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mt-1">Income</span>
                                </button>
                                <button
                                    onClick={() => router.push("/ledger/new?type=debit")}
                                    className="flex flex-col items-center justify-center p-8 rounded-2xl bg-rose-50 border-2 border-rose-100 hover:border-rose-500 hover:bg-rose-100 transition-all group"
                                >
                                    <div className="p-4 bg-rose-100 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                        <ArrowTrendingDownIcon className="h-8 w-8 text-rose-600" />
                                    </div>
                                    <span className="font-black text-rose-800 text-lg">Cash-Out</span>
                                    <span className="text-[10px] font-bold text-rose-600/60 uppercase tracking-widest mt-1">Expense</span>
                                </button>
                            </div>
                            <div className="px-8 pb-8">
                                <button
                                    onClick={() => setShowTransactionModal(false)}
                                    className="w-full py-4 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all font-bold text-sm uppercase tracking-widest"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <LoadingSpinner size="lg" message="Loading Workspace..." />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
