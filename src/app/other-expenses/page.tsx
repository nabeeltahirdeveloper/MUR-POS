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
    BanknotesIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    PlusIcon,
    TrashIcon,
    PencilSquareIcon,
} from "@heroicons/react/24/outline";
import type { FirestoreExpense } from "@/types/firestore";

function OtherExpensesPageContent() {
    const searchParams = useSearchParams();
    const { showConfirm } = useAlert();
    const [expenses, setExpenses] = useState<FirestoreExpense[]>([]);
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

    const fetchExpenses = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/other-expenses");
            if (!res.ok) throw new Error("Failed to fetch expenses");
            const data = await res.json();
            setExpenses(data);
        } catch (e: any) {
            setError(e.message || "Failed to fetch expenses");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    // Handle edit parameter from URL
    useEffect(() => {
        const editId = searchParams.get("edit");
        if (editId && expenses.length > 0) {
            const expense = expenses.find(u => u.id === editId);
            if (expense) {
                startEdit(expense);
                setTimeout(() => {
                    const formElement = document.querySelector('form');
                    formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }, [searchParams, expenses]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const url = editingId ? `/api/other-expenses/${editingId}` : "/api/other-expenses";
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
                throw new Error(data?.error || "Failed to save expense");
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
            await fetchExpenses();
        } catch (e: any) {
            setError(e.message || "Failed to save expense");
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (expense: FirestoreExpense) => {
        const newStatus = expense.status === "paid" ? "unpaid" : "paid";
        try {
            const res = await fetch(`/api/other-expenses/${expense.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            await fetchExpenses();
        } catch (e: any) {
            setError(e.message || "Failed to update status");
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!await showConfirm(`Delete expense "${name}"?`, { variant: "danger", title: "Confirm Deletion" })) return;
        try {
            const res = await fetch(`/api/other-expenses/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete expense");
            await fetchExpenses();
        } catch (e: any) {
            setError(e.message || "Failed to delete expense");
        }
    };

    const startEdit = (expense: FirestoreExpense) => {
        const dateStr = expense.dueDate instanceof Date
            ? expense.dueDate.toISOString().split("T")[0]
            : new Date(expense.dueDate).toISOString().split("T")[0];

        setForm({
            name: expense.name,
            amount: String(expense.amount),
            dueDate: dateStr,
            category: expense.category || "",
            status: expense.status,
        });
        setEditingId(expense.id);
        setShowForm(true);
    };

    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const unpaid = expenses.filter(u => u.status === "unpaid");
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
    }, [expenses]);

    const columns = [
        {
            key: "name",
            header: "Expense Name",
            render: (value: string, row: FirestoreExpense) => (
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
                const isOverdue = date < new Date() && expenses.find(u => u.dueDate === value)?.status === 'unpaid';
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
            render: (value: string, row: FirestoreExpense) => (
                <button
                    onClick={() => toggleStatus(row)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${value === "paid"
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
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
            render: (_: any, row: FirestoreExpense) => (
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => startEdit(row)}
                        className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
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
                        <h1 className="text-2xl font-bold text-gray-900">Other Expenses</h1>
                        <p className="text-sm text-gray-500">Track and manage your general expenses</p>
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
                        {showForm ? "Cancel" : "Add Expense"}
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
                            <p className="text-sm font-medium text-gray-500">Overdue Expenses</p>
                            <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <CalendarIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Due within 7 days</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.upcomingCount}</p>
                        </div>
                    </div>
                </div>

                {showForm && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            {editingId ? <PencilSquareIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                            {editingId ? "Edit Expense" : "Add New Expense"}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Expense Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Office Repair, Marketing"
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
                                        placeholder="e.g., General, Maintenance"
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
                                    {editingId ? "Update Expense" : "Save Expense"}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 text-lg">Expense List</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                            {expenses.length} Total
                        </div>
                    </div>
                    {loading ? (
                        <LoadingSpinner message="Fetching your expenses..." />
                    ) : (
                        <Table
                            data={expenses}
                            columns={columns}
                            emptyMessage="No expenses recorded yet. Add your first one above!"
                        />
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function OtherExpensesPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <LoadingSpinner />
                </div>
            </DashboardLayout>
        }>
            <OtherExpensesPageContent />
        </Suspense>
    );
}
