"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import {
    BanknotesIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    PlusIcon,
    TrashIcon,
    EyeIcon,
    ArrowUpCircleIcon,
    ArrowDownCircleIcon,
} from "@heroicons/react/24/outline";
import type { FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";
import DebtDetails from "@/components/debts/DebtDetails";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAlert } from "@/contexts/AlertContext";

interface DebtWithPayments extends FirestoreDebt {
    payments?: FirestoreDebtPayment[];
    totalPaid?: number;
    balance?: number;
}

export default function DebtsPage() {
    const { showConfirm } = useAlert();
    const [debts, setDebts] = useState<DebtWithPayments[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<DebtWithPayments | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    const [form, setForm] = useState({
        personName: "",
        type: "loaned_out" as "loaned_out" | "loaned_in",
        amount: "",
        dueDate: "",
        note: "",
    });

    const fetchDebts = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/debts");
            if (!res.ok) throw new Error("Failed to fetch debts");
            const data = await res.json();

            // We need to fetch payments for each debt to calculate balance
            // Alternatively, the API could return this summary.
            // For now, let's just fetch them and then enrich them or have individual details fetch.
            // To be efficient, let's assume we fetch details when clicking "View".
            // But for the list view balance, we might need more data.
            // Let's modify the API /api/debts to include basic payment summary if possible or do it here.

            // For now, I'll calculate balance when the details are fetched or if I fetch the payments collection.
            // Actually, in Firestore we usually store a CurrentBalance on the doc or fetch all payments.
            // Let's keep it simple: List shows total amount, Detail shows payments and balance.

            setDebts(data);
        } catch (e: any) {
            setError(e.message || "Failed to fetch debts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDebts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/debts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    amount: Number(form.amount),
                }),
            });

            if (!res.ok) throw new Error("Failed to save debt");

            setForm({
                personName: "",
                type: "loaned_out",
                amount: "",
                dueDate: "",
                note: "",
            });
            setShowForm(false);
            await fetchDebts();
        } catch (e: any) {
            setError(e.message || "Failed to save debt");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!await showConfirm(`Delete debt for "${name}"? This will also delete all payment history.`, { variant: "danger" })) return;
        try {
            const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete debt");
            await fetchDebts();
        } catch (e: any) {
            setError(e.message || "Failed to delete debt");
        }
    };

    const stats = useMemo(() => {
        const loanedOut = debts.filter(d => d.type === 'loaned_out' && d.status === 'active');
        const loanedIn = debts.filter(d => d.type === 'loaned_in' && d.status === 'active');

        return {
            totalLoanedOut: loanedOut.reduce((sum, d) => sum + d.amount, 0),
            totalLoanedIn: loanedIn.reduce((sum, d) => sum + d.amount, 0),
            activeCount: debts.filter(d => d.status === 'active').length
        };
    }, [debts]);

    const columns = [
        {
            key: "personName",
            header: "Person / Entity",
            render: (value: string, row: FirestoreDebt) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{value}</span>
                    <span className="text-xs text-gray-500">{row.note || "No notes"}</span>
                </div>
            )
        },
        {
            key: "type",
            header: "Type",
            render: (value: string) => (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${value === "loaned_out"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-purple-100 text-purple-800"
                    }`}>
                    {value === "loaned_out" ? <ArrowUpCircleIcon className="h-3.5 w-3.5" /> : <ArrowDownCircleIcon className="h-3.5 w-3.5" />}
                    {value === "loaned_out" ? "LOAN-OUT" : "LOAN-IN"}
                </span>
            )
        },
        {
            key: "amount",
            header: "Amount",
            render: (value: number) => (
                <span className="font-mono font-bold text-gray-900">Rs. {value.toLocaleString()}</span>
            )
        },
        {
            key: "dueDate",
            header: "Due Date",
            render: (value: any) => value ? new Date(value).toLocaleDateString() : "No date"
        },
        {
            key: "status",
            header: "Status",
            render: (value: string) => (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${value === "paid"
                    ? "bg-green-100 text-green-800"
                    : "bg-primary/10 text-primary"
                    }`}>
                    {value === "paid" ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
                    {value.toUpperCase()}
                </span>
            )
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: DebtWithPayments) => (
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setSelectedDebt(row);
                            setShowDetails(true);
                        }}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="View Details & Payments"
                    >
                        <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id, row.personName)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
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
                        <h1 className="text-2xl font-bold text-gray-900">Loans Management</h1>
                        <p className="text-sm text-gray-500">Track money given to others and money taken from others</p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2"
                    >
                        {showForm ? <XCircleIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                        {showForm ? "Cancel" : "Record New"}
                    </Button>
                </div>

                {error && <ErrorDisplay message={error} />}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <ArrowUpCircleIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Loaned Out (Active)</p>
                            <p className="text-2xl font-bold text-gray-900">Rs. {stats.totalLoanedOut.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <ArrowDownCircleIcon className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Loaned In (Active)</p>
                            <p className="text-2xl font-bold text-gray-900">Rs. {stats.totalLoanedIn.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                            <BanknotesIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Records</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.activeCount}</p>
                        </div>
                    </div>
                </div>

                {showForm && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <PlusIcon className="h-5 w-5" />
                            Record New Loan-In or Loan-Out
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Person / Entity Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter name"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.personName}
                                        onChange={(e) => setForm({ ...form, personName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Type</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                                    >
                                        <option value="loaned_out">Loan-Out (Money Given)</option>
                                        <option value="loaned_in">Loan-In (Money Taken)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">Rs.</span>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                            value={form.amount}
                                            onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date (Optional)</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.dueDate}
                                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                                    <input
                                        type="text"
                                        placeholder="Add any additional details"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-gray-900"
                                        value={form.note}
                                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" isLoading={saving} className="px-8 shadow-lg shadow-blue-200">
                                    Save Record
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 text-lg">Loan-In & Loan-Out Records</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                            {debts.length} Records
                        </div>
                    </div>
                    {loading ? (
                        <LoadingSpinner message="Loading records..." />
                    ) : (
                        <Table
                            data={debts}
                            columns={columns}
                            emptyMessage="No loan or debt records found."
                        />
                    )}
                </div>
            </div>

            {selectedDebt && (
                <DebtDetails
                    debt={selectedDebt}
                    isOpen={showDetails}
                    onClose={() => {
                        setShowDetails(false);
                        setSelectedDebt(null);
                        fetchDebts();
                    }}
                />
            )}
        </DashboardLayout>
    );
}
