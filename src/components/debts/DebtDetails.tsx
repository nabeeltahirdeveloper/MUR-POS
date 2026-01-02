"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import {
    XMarkIcon,
    PlusIcon,
    BanknotesIcon,
    CalendarIcon,
    UserCircleIcon,
    ArrowUpCircleIcon,
    ArrowDownCircleIcon,
    ClipboardDocumentListIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import type { FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";

interface DebtDetailsProps {
    debt: FirestoreDebt;
    isOpen: boolean;
    onClose: () => void;
}

export default function DebtDetails({ debt, isOpen, onClose }: DebtDetailsProps) {
    const [details, setDetails] = useState<(FirestoreDebt & { payments: FirestoreDebtPayment[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        note: "",
    });

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/debts/${debt.id}`);
            if (!res.ok) throw new Error("Failed to fetch details");
            const data = await res.json();
            setDetails(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchDetails();
        }
    }, [isOpen, debt.id]);

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/debts/${debt.id}/payments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...paymentForm,
                    amount: Number(paymentForm.amount),
                }),
            });

            if (!res.ok) throw new Error("Failed to add payment");

            setPaymentForm({
                amount: "",
                date: new Date().toISOString().split("T")[0],
                note: "",
            });
            setShowPaymentForm(false);
            await fetchDetails();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const totalPaid = details?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const balance = (details?.amount || 0) - totalPaid;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${debt.type === 'loaned_out' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                            {debt.type === 'loaned_out' ? <ArrowUpCircleIcon className="h-6 w-6 text-blue-600" /> : <ArrowDownCircleIcon className="h-6 w-6 text-purple-600" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{debt.personName}</h2>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                {debt.type === 'loaned_out' ? "Loan Given" : "Loan Taken"} •
                                Record Date: {new Date(debt.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-all">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {error && <ErrorDisplay message={error} />}

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                            <p className="text-sm font-medium text-gray-500 mb-1">Total Amount</p>
                            <p className="text-2xl font-bold text-gray-900">Rs. {details?.amount?.toLocaleString() || "0"}</p>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                            <p className="text-sm font-medium text-gray-500 mb-1">Total Paid</p>
                            <p className="text-2xl font-bold text-green-600">Rs. {totalPaid.toLocaleString()}</p>
                        </div>
                        <div className={`${balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'} p-6 rounded-xl border`}>
                            <p className="text-sm font-medium text-gray-500 mb-1">Remaining Balance</p>
                            <p className={`text-2xl font-bold ${balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                Rs. {balance.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Information Row */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <ClipboardDocumentListIcon className="h-5 w-5" />
                                Details
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                                    <span className="text-sm text-gray-500">Due Date</span>
                                    <span className="text-sm font-semibold text-gray-900">
                                        {debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : "No due date"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                                    <span className="text-sm text-gray-500">Status</span>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${debt.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                        {debt.status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="py-3">
                                    <span className="text-sm text-gray-500 block mb-2">Note</span>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg italic">
                                        {debt.note || "No additional notes provided."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Payments Section */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <BanknotesIcon className="h-5 w-5" />
                                    Payment History
                                </h3>
                                {balance > 0 && !showPaymentForm && (
                                    <button
                                        onClick={() => setShowPaymentForm(true)}
                                        className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Add Payment
                                    </button>
                                )}
                            </div>

                            {showPaymentForm && (
                                <form onSubmit={handleAddPayment} className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 space-y-4 animate-fadeIn">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Amount</label>
                                            <input
                                                type="number"
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={paymentForm.amount}
                                                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                                max={balance}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
                                            <input
                                                type="date"
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={paymentForm.date}
                                                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Note (Optional)</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={paymentForm.note}
                                            onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                                            placeholder="e.g., Partial cash payment"
                                        />
                                    </div>
                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button type="button" onClick={() => setShowPaymentForm(false)} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                                        <Button type="submit" size="sm" isLoading={saving}>Record Payment</Button>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {loading ? (
                                    <div className="animate-pulse space-y-4">
                                        {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
                                    </div>
                                ) : details?.payments?.length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <p className="text-sm text-gray-500">No payments recorded yet.</p>
                                    </div>
                                ) : (
                                    details?.payments?.map((payment) => (
                                        <div key={payment.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-green-50 rounded-lg">
                                                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">Rs. {payment.amount.toLocaleString()}</p>
                                                    <p className="text-xs text-gray-500">{new Date(payment.date).toLocaleDateString()} {payment.note ? `• ${payment.note}` : ''}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <Button variant="secondary" onClick={onClose}>Close Details</Button>
                </div>
            </div>
        </div>
    );
}
