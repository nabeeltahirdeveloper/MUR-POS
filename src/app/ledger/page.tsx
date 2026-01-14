"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, FunnelIcon, XMarkIcon, UsersIcon, ListBulletIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, BuildingStorefrontIcon, BanknotesIcon, WrenchScrewdriverIcon, PrinterIcon } from "@heroicons/react/24/outline";
import LedgerTable from "@/components/ledger/LedgerTable";
import LedgerPendingTable from "@/components/ledger/LedgerPendingTable";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DashboardLayout } from "@/components/layout";
import LedgerCustomerSummary from "@/components/ledger/LedgerCustomerSummary";
import LedgerSupplierSummary from "@/components/ledger/LedgerSupplierSummary";
import LedgerLoanSummary from "@/components/ledger/LedgerLoanSummary";
import LedgerUtilitySummary from "@/components/ledger/LedgerUtilitySummary";
import { useAlert } from "@/contexts/AlertContext";

function LedgerPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showConfirm } = useAlert();
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
    const [view, setView] = useState<"entries" | "customers" | "suppliers" | "loans" | "utilities" | "pending">((searchParams.get("view") as any) || "entries");

    // Sync view with URL param
    useEffect(() => {
        const viewParam = searchParams.get("view");
        if (viewParam && ["entries", "customers", "suppliers", "loans", "utilities", "pending"].includes(viewParam)) {
            setView(viewParam as any);
        }
    }, [searchParams]);

    const handleViewChange = (newView: "entries" | "customers" | "suppliers" | "loans" | "utilities" | "pending") => {
        setView(newView);
        router.push(`/ledger?view=${newView}`);
    };

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
        if (!await showConfirm("Delete this entry?", { variant: "danger", title: "Delete Transaction" })) return;

        // Try to find the order number from the entry notes
        const entryToDelete: any = entries.find((e: any) => String(e.id) === String(id));
        const orderMatch = entryToDelete?.note?.match(/Order #\s*([^\s\n]+)/);
        const orderNum = orderMatch ? orderMatch[1].trim() : null;

        try {
            const res = await fetch(`/api/ledger/${id}`, { method: "DELETE" });
            if (res.ok) {
                // Delete associated debt if order number exists
                if (orderNum) {
                    try {
                        const debtsRes = await fetch('/api/debts');
                        if (debtsRes.ok) {
                            const debts = await debtsRes.json();
                            const existingDebt = debts.find((d: any) => d.note?.includes(`Order #${orderNum}`));
                            if (existingDebt) {
                                await fetch(`/api/debts/${existingDebt.id}`, { method: "DELETE" });
                            }
                        }
                    } catch (debtErr) {
                        console.error("Failed to delete associated debt:", debtErr);
                    }
                }

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
        !!(filters.search || filters.type || filters.categoryId || filters.from || filters.to);

    const handleViewEntries = (name: string) => {
        setFilters(prev => ({ ...prev, search: name, page: 1 }));
        setView("entries");
    };

    // Filter Logic for Pending vs All
    // isPending: Note regex matches Remaining: > 0
    const checkIsPending = (note: string | null) => {
        if (!note) return false;
        const match = note.match(/Remaining: (\d+(\.\d+)?)/);
        return match ? Number(match[1]) > 0 : false;
    };

    const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

    useEffect(() => {
        // Clear selection when filters change
        setSelectedIds([]);
        fetchEntries();
    }, [filters]);

    // ... (keep existing fetchCategories, fetchEntries, handleDelete)

    const handlePrint = () => {
        const query = new URLSearchParams();

        // Always pass the current view
        query.append("view", view);

        if (view === "entries" || view === "pending") {
            if (selectedIds.length > 0) {
                query.append("ids", selectedIds.join(","));
            } else {
                (Object.keys(filters) as Array<keyof typeof filters>).forEach((key) => {
                    if (filters[key]) query.append(key, String(filters[key]));
                });
            }
        }

        window.open(`/ledger/print?${query.toString()}`, '_blank');
    };

    return (
        <div className="space-y-6 relative pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Ledger</h1>
                <div className="flex gap-2 shrink-0 overflow-x-auto pb-2 sm:pb-0">
                    <div className="bg-gray-100 p-1 rounded-lg flex mr-2 whitespace-nowrap">
                        <button
                            onClick={() => handleViewChange("customers")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "customers"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                } cursor-pointer`}
                        >
                            <UsersIcon className="h-4 w-4 mr-1.5" />
                            By Customer
                        </button>
                        <button
                            onClick={() => handleViewChange("suppliers")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "suppliers"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                } cursor-pointer`}
                        >
                            <BuildingStorefrontIcon className="h-4 w-4 mr-1.5" />
                            By Supplier
                        </button>
                        <button
                            onClick={() => handleViewChange("loans")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "loans"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                } cursor-pointer`}
                        >
                            <BanknotesIcon className="h-4 w-4 mr-1.5" />
                            Loans
                        </button>
                        <button
                            onClick={() => handleViewChange("utilities")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "utilities"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                } cursor-pointer`}
                        >
                            <WrenchScrewdriverIcon className="h-4 w-4 mr-1.5" />
                            Utilities
                        </button>
                        <button
                            onClick={() => handleViewChange("entries")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "entries"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                } cursor-pointer`}
                        >
                            <ListBulletIcon className="h-4 w-4 mr-1.5" />
                            All Entries
                        </button>
                        <button
                            onClick={() => handleViewChange("pending")}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${view === "pending"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                } cursor-pointer`}
                        >
                            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pending
                        </button>
                    </div>

                    <Button
                        variant={hasActiveFilters ? "primary" : "secondary"} // Visual cue on the button too
                        className={hasActiveFilters ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100" : ""}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FunnelIcon className={`h-5 w-5 mr-2 ${hasActiveFilters ? "text-blue-700" : ""}`} />
                        Filters
                        {hasActiveFilters && (
                            <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
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
                                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer"
                            >
                                <XMarkIcon className="h-4 w-4" />
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Search
                            </label>
                            <input
                                type="text"
                                className={`w-full p-2 pr-10 border rounded-md text-sm text-gray-900 outline-none transition-all ${filters.search
                                    ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10'
                                    : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                    }`}
                                placeholder="Search Name or Note..."
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

                        {/* Type and Category only for Entry views */}
                        {view === "entries" && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Type
                                    </label>
                                    <select
                                        className={`w-full p-2 border rounded-md text-sm outline-none transition-all ${filters.type
                                            ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10'
                                            : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                            }`}
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
                                        className={`w-full p-2 border rounded-md text-sm outline-none transition-all ${filters.categoryId
                                            ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10'
                                            : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                            }`}
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
                            </>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Date Range
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    className={`w-full p-2 border rounded-md text-xs outline-none transition-all ${filters.from
                                        ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10'
                                        : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    value={filters.from}
                                    onChange={(e) => updateFilter("from", e.target.value)}
                                />
                                <input
                                    type="date"
                                    className={`w-full p-2 border rounded-md text-xs outline-none transition-all ${filters.to
                                        ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10'
                                        : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    value={filters.to}
                                    onChange={(e) => updateFilter("to", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === "customers" ? (
                <LedgerCustomerSummary onViewEntries={handleViewEntries} filters={filters} />
            ) : view === "suppliers" ? (
                <LedgerSupplierSummary onViewEntries={handleViewEntries} filters={filters} />
            ) : view === "loans" ? (
                <LedgerLoanSummary filters={filters} />
            ) : view === "utilities" ? (
                <LedgerUtilitySummary filters={filters} />
            ) : view === "pending" ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-yellow-50">
                        <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Pending Payments
                        </h3>
                        <p className="text-sm text-yellow-700 mt-1">Transactions with remaining balance &gt; 0</p>
                    </div>
                    {/* Use dedicated Pending Table */}
                    <LedgerPendingTable
                        data={entries.filter((e: any) => checkIsPending(e.note))}
                        loading={loading}
                        onEdit={(id) => router.push(`/ledger/${id}/edit`)}
                        onDelete={handleDelete}
                    />
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Exclude pending from All Entries */}
                    <LedgerTable
                        data={entries.filter((e: any) => !checkIsPending(e.note))}
                        loading={loading}
                        onEdit={(id) => router.push(`/ledger/${id}/edit`)}
                        onDelete={handleDelete}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
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

            {/* Floating Print Button - Only for supported views */}
            {['entries', 'customers', 'suppliers'].includes(view) && (
                <div className="fixed bottom-8 right-8 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Button
                        onClick={handlePrint}
                        className="shadow-2xl hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 rounded-full px-6 py-4 h-auto text-base font-bold bg-gray-900 text-white border-2 border-white/20 backdrop-blur-sm"
                    >
                        <PrinterIcon className="h-5 w-5 mr-2" />
                        {selectedIds.length > 0 ? `Print (${selectedIds.length})` : 'Print Report'}
                    </Button>
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
                                className="flex flex-col items-center justify-center p-8 rounded-2xl bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-100 transition-all group cursor-pointer"
                            >
                                <div className="p-4 bg-emerald-100 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                    <ArrowTrendingUpIcon className="h-8 w-8 text-emerald-600" />
                                </div>
                                <span className="font-black text-emerald-800 text-lg">Cash-In</span>
                                <span className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mt-1">Income</span>
                            </button>
                            <button
                                onClick={() => router.push("/ledger/new?type=debit")}
                                className="flex flex-col items-center justify-center p-8 rounded-2xl bg-rose-50 border-2 border-rose-100 hover:border-rose-500 hover:bg-rose-100 transition-all group cursor-pointer"
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
                                className="w-full py-4 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all font-bold text-sm uppercase tracking-widest cursor-pointer"
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
            <Suspense fallback={<div className="flex justify-center p-8"><LoadingSpinner /></div>}>
                <LedgerPageContent />
            </Suspense>
        </DashboardLayout>
    );
}
