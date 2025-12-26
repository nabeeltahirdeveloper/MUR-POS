"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CategoryManager from "./CategoryManager";

type Category = {
    id: string;
    name: string;
};

type LedgerEntry = {
    id?: number;
    type: "debit" | "credit";
    amount: number | string;
    categoryId: string;
    note: string;
    date: string;
};

export default function LedgerEntryForm({
    initialData,
}: {
    initialData?: LedgerEntry;
}) {
    const router = useRouter();
    const [type, setType] = useState<"debit" | "credit">(
        initialData?.type || "debit"
    );
    const [amount, setAmount] = useState<string>(
        initialData?.amount?.toString() || ""
    );
    const [categoryId, setCategoryId] = useState<string>(
        (initialData?.categoryId as any) || ""
    );
    const [note, setNote] = useState(initialData?.note || "");
    const [date, setDate] = useState(
        initialData?.date
            ? new Date(initialData.date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    );
    const [categories, setCategories] = useState<Category[]>([]);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const isEdit = !!initialData?.id;

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        const res = await fetch("/api/ledger/categories");
        if (res.ok) {
            const data = await res.json();
            setCategories(data);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!amount || Number(amount) <= 0) {
            setError("Amount must be greater than 0");
            setLoading(false);
            return;
        }
        if (!categoryId) {
            setError("Please select a category");
            setLoading(false);
            return;
        }

        try {
            const payload = {
                type,
                amount: Number(amount),
                categoryId: categoryId || null,
                note,
                date,
            };

            const url = isEdit ? `/api/ledger/${initialData.id}` : "/api/ledger";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save entry");
            }

            router.push("/ledger");
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {isEdit ? "Edit Ledger Entry" : "New Ledger Entry"}
            </h2>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Type Selection */}
                <div className="flex gap-4">
                    <label className="flex-1 cursor-pointer">
                        <input
                            type="radio"
                            name="type"
                            value="debit"
                            checked={type === "debit"}
                            onChange={() => setType("debit")}
                            className="peer sr-only"
                        />
                        <div className="text-center py-3 rounded-lg border-2 border-gray-200 peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700 transition-all">
                            Debit (Out)
                        </div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                        <input
                            type="radio"
                            name="type"
                            value="credit"
                            checked={type === "credit"}
                            onChange={() => setType("credit")}
                            className="peer sr-only"
                        />
                        <div className="text-center py-3 rounded-lg border-2 border-gray-200 peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:text-green-700 transition-all">
                            Credit (In)
                        </div>
                    </label>
                </div>

                {/* Amount */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount
                    </label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        step="0.01"
                        min="0"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="0.00"
                        required
                    />
                </div>

                {/* Category */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                            Category
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowCategoryManager(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            + Manage Categories
                        </button>
                    </div>
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        required
                    >
                        <option value="">Select a category</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                    </label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                    />
                </div>

                {/* Note */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Note (Optional)
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        rows={3}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                    {loading ? "Saving..." : isEdit ? "Update Entry" : "Save Entry"}
                </button>
            </form>

            {/* Category Manager Modal */}
            {showCategoryManager && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="max-w-md w-full">
                        <CategoryManager
                            onClose={() => setShowCategoryManager(false)}
                            onChange={fetchCategories}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
