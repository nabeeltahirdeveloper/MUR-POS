"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, FunnelIcon, XMarkIcon, UsersIcon, ListBulletIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, BuildingStorefrontIcon } from "@heroicons/react/24/outline";
import LedgerTable from "@/components/ledger/LedgerTable";
import { Button } from "@/components/ui/Button";
import { DashboardLayout } from "@/components/layout";
import LedgerCustomerSummary from "@/components/ledger/LedgerCustomerSummary";
import LedgerSupplierSummary from "@/components/ledger/LedgerSupplierSummary";

function LedgerPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        page: 1,
        limit: 20,
        search: "",
        type: "",
        categoryId: "",
        from: "",
        to: "",
    });
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [view, setView] = useState<"entries" | "customers" | "suppliers">("entries");
    const [showTransactionModal, setShowTransactionModal] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [filters]);

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/ledger/categories");
            if (res.ok) setCategories(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            (Object.keys(filters) as Array<keyof typeof filters>).forEach((key) => {
                if (filters[key]) query.append(key, String(filters[key]));
            });

            const url = `/api/ledger?${query.toString()}`;
            console.debug('[ledger page] fetching', url);
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                console.debug('[ledger page] response meta', data?.meta);
                setEntries(data.data || []);
                setTotalPages(data.meta?.totalPages || 1);
            } else {
                console.warn('[ledger page] fetch failed', res.status);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number | string) => {
        if (!confirm("Delete this entry?")) return;
        try {
            const res = await fetch(`/api/ledger/${id}`, { method: "DELETE" });
            if (res.ok) {
                // Update local list
                fetchEntries();

                // Update session storage for Recent Transactions in other views
                try {
                    const saved = sessionStorage.getItem("recentTransactions");
                    if (saved) {
                        const recent = JSON.parse(saved);
                        const updated = recent.filter((tx: any) => String(tx.id) !== String(id));
                        sessionStorage.setItem("recentTransactions", JSON.stringify(updated));
                    }
                } catch (e) {
                    console.error("Failed to update recent transactions storage", e);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const updateFilter = (key: string, value: string | number) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    };

    const clearFilters = () => {
        setFilters({
            page: 1,
            limit: 20,
            search: "",
            type: "",
            categoryId: "",
            from: "",
            to: "",
        });
    };

    const hasActiveFilters =
        filters.search || filters.type || filters.categoryId || filters.from || filters.to;

    const handleViewEntries = (name: string) => {
        setFilters(prev => ({ ...prev, search: name, page: 1 }));
        setView("entries");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Ledger</h1>
                <div className="flex gap-2 shrink-0">
                    <div className="bg-gray-100 p-1 rounded-lg flex mr-2">
                        <button
                            onClick={() => setView("customers")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "customers"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <UsersIcon className="h-4 w-4 mr-1.5" />
                            By Customer
                        </button>
                        <button
                            onClick={() => setView("suppliers")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "suppliers"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <BuildingStorefrontIcon className="h-4 w-4 mr-1.5" />
                            By Supplier
                        </button>
                        <button
                            onClick={() => setView("entries")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "entries"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <ListBulletIcon className="h-4 w-4 mr-1.5" />
                            All Entries
                        </button>
                    </div>

                    <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
                        <FunnelIcon className="h-5 w-5 mr-2" />
                        Filters
                        {hasActiveFilters && (
                            <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                                Active
                            </span>
                        )}
                    </Button>

                    <Button onClick={() => setShowTransactionModal(true)}>
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Add Entry
                    </Button>
                </div>
            </div>

            {showFilters && (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900">Filters</h3>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                                <XMarkIcon className="h-4 w-4" />
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Search Note
                            </label>
                            <input
                                type="text"
                                className="w-full p-2 pr-10 border rounded-md text-sm text-gray-900"
                                placeholder="Search..."
                                value={filters.search}
                                onChange={(e) => updateFilter("search", e.target.value)}
                            />
                            {loading && (
                                <span className="absolute right-3 bottom-2">
                                    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </span>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Type
                            </label>
                            <select
                                className="w-full p-2 border rounded-md text-sm"
                                value={filters.type}
                                onChange={(e) => updateFilter("type", e.target.value)}
                            >
                                <option value="">All</option>
                                <option value="credit">Cash-In</option>
                                <option value="debit">Cash-Out</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Category
                            </label>
                            <select
                                className="w-full p-2 border rounded-md text-sm"
                                value={filters.categoryId}
                                onChange={(e) => updateFilter("categoryId", e.target.value)}
                            >
                                <option value="">All</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Date Range
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    className="w-full p-2 border rounded-md text-xs"
                                    value={filters.from}
                                    onChange={(e) => updateFilter("from", e.target.value)}
                                />
                                <input
                                    type="date"
                                    className="w-full p-2 border rounded-md text-xs"
                                    value={filters.to}
                                    onChange={(e) => updateFilter("to", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === "customers" ? (
                <LedgerCustomerSummary onViewEntries={handleViewEntries} />
            ) : view === "suppliers" ? (
                <LedgerSupplierSummary onViewEntries={handleViewEntries} />
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <LedgerTable
                        data={entries}
                        loading={loading}
                        onEdit={(id) => router.push(`/ledger/${id}/edit`)}
                        onDelete={handleDelete}
                    />

                    {/* Pagination */}
                    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <Button
                                disabled={filters.page <= 1}
                                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                                size="sm"
                            >
                                Previous
                            </Button>
                            <Button
                                disabled={filters.page >= totalPages}
                                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                                size="sm"
                            >
                                Next
                            </Button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Page <span className="font-medium">{filters.page}</span> of{" "}
                                    <span className="font-medium">{totalPages}</span>
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    disabled={filters.page <= 1}
                                    onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                                    size="sm"
                                    variant="secondary"
                                >
                                    Previous
                                </Button>
                                <Button
                                    disabled={filters.page >= totalPages}
                                    onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                                    size="sm"
                                    variant="secondary"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
    );
}

export default function LedgerPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<div>Loading...</div>}>
                <LedgerPageContent />
            </Suspense>
        </DashboardLayout>
    );
}
