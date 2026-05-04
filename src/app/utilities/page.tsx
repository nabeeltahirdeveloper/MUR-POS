"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAlert } from "@/contexts/AlertContext";
import {
    BoltIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    PlusIcon,
    TrashIcon,
    PencilSquareIcon,
} from "@heroicons/react/24/outline";
import type { ApiUtility } from "@/types/models";

function UtilitiesPageContent() {
    const searchParams = useSearchParams();
    const { showConfirm } = useAlert();
    const [utilities, setUtilities] = useState<ApiUtility[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        amount: "",
        dueDate: new Date().toISOString().split("T")[0],
        category: "",
        status: "unpaid" as "paid" | "unpaid",
    });

    const fetchUtilities = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/utilities");
            if (!res.ok) throw new Error("Failed to fetch utilities");
            const data = await res.json();
            setUtilities(data);
        } catch (e: any) {
            setError(e.message || "Failed to fetch utilities");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUtilities();
    }, []);

    // Handle edit parameter from URL
    useEffect(() => {
        const editId = searchParams.get("edit");
        if (editId && utilities.length > 0) {
            const utility = utilities.find(u => u.id === editId);
            if (utility) {
                startEdit(utility);
                // Scroll to form
                setTimeout(() => {
                    const formElement = document.querySelector('form');
                    formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }, [searchParams, utilities]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const url = editingId ? `/api/utilities/${editingId}` : "/api/utilities";
            const method = editingId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    amount: Number(form.amount),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data?.error || "Failed to save utility");
            }

            setForm({
                name: "",
                amount: "",
                dueDate: new Date().toISOString().split("T")[0],
                category: "",
                status: "unpaid",
            });
            setShowForm(false);
            setEditingId(null);
            await fetchUtilities();
        } catch (e: any) {
            setError(e.message || "Failed to save utility");
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (utility: ApiUtility) => {
        const newStatus = utility.status === "paid" ? "unpaid" : "paid";
        try {
            const res = await fetch(`/api/utilities/${utility.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            await fetchUtilities();
        } catch (e: any) {
            setError(e.message || "Failed to update status");
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!await showConfirm(`Delete utility bill "${name}"?`, { variant: "danger", title: "Confirm Deletion" })) return;
        try {
            const res = await fetch(`/api/utilities/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete utility");
            await fetchUtilities();
        } catch (e: any) {
            setError(e.message || "Failed to delete utility");
        }
    };

    const startEdit = (utility: ApiUtility) => {
        const dateStr = utility.dueDate instanceof Date
            ? utility.dueDate.toISOString().split("T")[0]
            : new Date(utility.dueDate).toISOString().split("T")[0];

        setForm({
            name: utility.name,
            amount: String(utility.amount),
            dueDate: dateStr,
            category: utility.category || "",
            status: utility.status,
        });
        setEditingId(utility.id);
        setShowForm(true);
    };

    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const unpaid = utilities.filter(u => u.status === "unpaid");
        const totalUnpaid = unpaid.reduce((sum, u) => sum + u.amount, 0);

        const overdue = unpaid.filter(u => {
            const d = new Date(u.dueDate);
            d.setHours(0, 0, 0, 0);
            return d < now;
        });

        const upcoming = unpaid.filter(u => {
            const d = new Date(u.dueDate);
            d.setHours(0, 0, 0, 0);
            const diff = d.getTime() - now.getTime();
            const days = diff / (1000 * 60 * 60 * 24);
            return days >= 0 && days <= 7;
        });

        return {
            totalUnpaid,
            overdueCount: overdue.length,
            upcomingCount: upcoming.length,
            overdueAmount: overdue.reduce((sum, u) => sum + u.amount, 0)
        };
    }, [utilities]);

    const columns = [
        {
            key: "name",
            header: "Utility Name",
            render: (value: string, row: ApiUtility) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{value}</span>
                    <span className="text-xs text-gray-500">{row.category || "General"}</span>
                </div>
            )
        },
        {
            key: "amount",
            header: "Amount",
            render: (value: number) => (
                <span className="font-mono text-gray-900">Rs. {value.toFixed(2)}</span>
            )
        },
        {
            key: "dueDate",
            header: "Due Date",
            render: (value: any) => {
                const date = new Date(value);
                const isOverdue = date < new Date() && utilities.find(u => u.dueDate === value)?.status === 'unpaid';
                return (
                    <span className={`text-sm ${isOverdue ? "text-red-600 font-bold" : "text-gray-600"}`}>
                        {date.toLocaleDateString()}
                    </span>
                );
            }
        },
        {
            key: "status",
            header: "Status",
            render: (value: string, row: ApiUtility) => (
                <button
                    onClick={() => toggleStatus(row)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${value === "paid"
                        ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                        } cursor-pointer`}
                >
                    {value === "paid" ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <XCircleIcon className="h-3.5 w-3.5" />}
                    {value.toUpperCase()}
                </button>
            )
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: ApiUtility) => (
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => startEdit(row)}
                        className="text-gray-400 hover:text-primary transition-colors cursor-pointer"
                    >
                        <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id, row.name)}
                        className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Utility & Expense Management</h1>
                        <p className="text-sm text-gray-500">Track and manage your monthly bills and utilities</p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => {
                            setEditingId(null);
                            setForm({
                                name: "",
                                amount: "",
                                dueDate: new Date().toISOString().split("T")[0],
                                category: "",
                                status: "unpaid",
                            });
                            setShowForm(!showForm);
                        }}
                        className="flex items-center gap-2"
                    >
                        {showForm ? <XCircleIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                        {showForm ? "Cancel" : "Add Bill"}
                    </Button>
                </div>

                {error && <ErrorDisplay message={error} />}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                            <CurrencyDollarIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Unpaid</p>
                            <p className="text-2xl font-bold text-gray-900">Rs. {stats.totalUnpaid.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-lg">
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Overdue Bills</p>
                            <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-primary/15 rounded-lg">
                            <CalendarIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Due within 7 days</p>
                            <p className="text-2xl font-bold text-primary">{stats.upcomingCount}</p>
                        </div>
                    </div>
                </div>

                {showForm && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            {editingId ? <PencilSquareIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                            {editingId ? "Edit Utility Bill" : "Add New Utility Bill"}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Utility Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Electricity, Rent, Internet"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">Rs.</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                            value={form.amount}
                                            onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.dueDate}
                                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Office, Home, General"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.category}
                                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value as "paid" | "unpaid" })}
                                    >
                                        <option value="unpaid">Unpaid</option>
                                        <option value="paid">Paid</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" isLoading={saving} className="px-8 shadow-lg shadow-blue-200">
                                    {editingId ? "Update Bill" : "Save Bill"}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 text-lg">Utility Bill List</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="inline-block w-2 h-2 rounded-full bg-primary/100"></span>
                            {utilities.length} Total
                        </div>
                    </div>
                    {loading ? (
                        <LoadingSpinner message="Fetching your bills..." />
                    ) : (
                        <Table
                            data={utilities}
                            columns={columns}
                            emptyMessage="No utility bills recorded yet. Add your first one above!"
                        />
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function UtilitiesPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <LoadingSpinner />
                </div>
            </DashboardLayout>
        }>
            <UtilitiesPageContent />
        </Suspense>
    );
}
