"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";


type LedgerEntry = {
    id?: number;
    type: "debit" | "credit";
    amount: number | string;
    categoryId: string;
    note: string;
    date: string;
};

type Item = {
    id: string;
    name: string;
    firstSalePrice?: number;
    secondPurchasePrice?: number;
    currentStock?: number;
    category?: { name: string };
};

export default function LedgerEntryForm({
    initialData,
}: {
    initialData?: LedgerEntry;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const typeParam = searchParams.get("type");
    const [type, setType] = useState<"debit" | "credit">(
        (typeParam === "credit" || typeParam === "debit" ? typeParam : initialData?.type) || "debit"
    );

    // Form State
    const [amount, setAmount] = useState<string>(
        initialData?.amount?.toString() || ""
    );
    const [note, setNote] = useState(initialData?.note || "");
    const [date, setDate] = useState(
        initialData?.date
            ? new Date(initialData.date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    );

    // Item Search State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Item[]>([]);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Calculations State
    const [quantity, setQuantity] = useState<string>("1");
    const [unitPrice, setUnitPrice] = useState<number>(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [recentTransactions, setRecentTransactions] = useState<LedgerEntry[]>([]);

    const isEdit = !!initialData?.id;

    // Close search results on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Item Search Handler
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 1 && !selectedItem) {
                setIsSearching(true);
                try {
                    const res = await fetch(`/api/items?search=${encodeURIComponent(searchTerm)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setSearchResults(data);
                        setShowResults(true);
                    }
                } catch (err) {
                    console.error("Failed to search items", err);
                } finally {
                    setIsSearching(false);
                }
            } else if (searchTerm.length === 0) { // Only clear if empty, 1 char is valid
                setSearchResults([]);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedItem]);

    // Update Price when Type or Item Changes
    useEffect(() => {
        if (selectedItem) {
            // Debit (Out/Expense) usually implies we are buying? 
            // The user prompt implies: "price of that item shown in the amount field".
            // Context: Ledger usually tracks money. 
            // Credit (Money In) -> Sale -> Use Sale Price (firstSalePrice)
            // Debit (Money Out) -> Expense/Purchase -> Use Purchase Price (secondPurchasePrice)

            let price = 0;
            if (type === "credit") {
                price = Number(selectedItem.firstSalePrice || 0);
            } else {
                price = Number(selectedItem.secondPurchasePrice || 0);
            }
            setUnitPrice(price);
        }
    }, [selectedItem, type]);

    // Calculate Total Amount
    useEffect(() => {
        if (unitPrice > 0 && quantity) {
            const qty = parseFloat(quantity);
            if (!isNaN(qty)) {
                const total = (qty * unitPrice).toFixed(2);
                setAmount(total);
            }
        }
    }, [unitPrice, quantity]);

    const handleSelectItem = (item: Item) => {
        setSelectedItem(item);
        setSearchTerm(item.name);
        setShowResults(false);
    };

    const handleClearItem = () => {
        setSelectedItem(null);
        setSearchTerm("");
        setUnitPrice(0);
        setAmount("");
        setQuantity("1");
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

        try {
            // Construct the final note
            let finalNote = note;
            if (selectedItem) {
                const itemDetails = `Item: ${selectedItem.name} (Qty: ${quantity} @ ${unitPrice})`;
                finalNote = finalNote ? `${finalNote}\n${itemDetails}` : itemDetails;
            }

            const payload = {
                type,
                amount: Number(amount),
                categoryId: null, // Category removed as requested
                note: finalNote,
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

            const newEntry = await res.json();

            // Add to recent transactions list
            setRecentTransactions(prev => [newEntry, ...prev]);

            // Reset Form instead of redirecting
            setAmount("");
            setQuantity("1");
            setUnitPrice(0);
            setNote("");
            setSelectedItem(null);
            setSelectedItem(null);
            setSearchTerm("");
            setLoading(false);

            // Optional: Show success feedback?
            // For now, the new card appearing at the bottom is the feedback.

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unexpected error occurred");
            }
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Header */}
                <div className={`px-8 py-6 ${type === 'credit' ? 'bg-emerald-600' : 'bg-red-600'} transition-colors duration-300`}>
                    <h2 className="text-2xl font-bold text-white">
                        {isEdit ? "Edit Transaction" : `New ${type === 'credit' ? 'Credit (In)' : 'Debit (Out)'} Entry`}
                    </h2>
                    <p className="text-white/80 text-sm mt-1">
                        Enter the details of the transaction below.
                    </p>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center shadow-sm">
                            <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Top Section: Search & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            {/* Search Bar - Larger Width */}
                            <div className="md:col-span-8 relative" ref={searchRef}>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            if (selectedItem && e.target.value !== selectedItem.name) {
                                                setSelectedItem(null); // Reset selection if typing
                                            }
                                        }}
                                        onFocus={() => {
                                            if (searchTerm.length >= 1) setShowResults(true);
                                        }}
                                        placeholder="Search for items..."
                                        className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm text-gray-800 placeholder-gray-400"
                                    />
                                    {selectedItem && (
                                        <button
                                            type="button"
                                            onClick={handleClearItem}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                {/* Search Results Dropdown */}
                                {showResults && (
                                    <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
                                        {isSearching ? (
                                            <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                                        ) : searchResults.length > 0 ? (
                                            <ul className="py-2">
                                                {searchResults.map((item) => (
                                                    <li
                                                        key={item.id}
                                                        onClick={() => handleSelectItem(item)}
                                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center group transition-colors"
                                                    >
                                                        <div>
                                                            <p className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                                                                {item.name}
                                                            </p>
                                                        </div>
                                                        <div className="text-right text-sm">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                {item.category?.name || "Uncategorized"}
                                                            </span>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 text-sm">No items found</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Date Field - Smaller Width, Next to Search */}
                            <div className="md:col-span-4">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm h-full"
                                />
                            </div>
                        </div>

                        {/* Quantity & Amount Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Quantity
                                </label>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    min="1"
                                    step="any"
                                    className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium text-lg text-slate-700"
                                    placeholder="1"
                                />
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Total Amount
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">Rs.</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        step="0.01"
                                        min="0"
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-bold text-lg text-slate-800"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Note Section (Date moved up) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Note / Description
                            </label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add any details here..."
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm min-h-[50px] resize-y"
                                rows={2}
                            />
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`px-8 py-2.5 rounded-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 ${loading
                                    ? "bg-blue-400 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-700"
                                    }`}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Saving...
                                    </span>
                                ) : (
                                    "Save Transaction"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Recent Transactions List */}
            {recentTransactions.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 px-2">Recent Transactions</h3>
                    <div className="space-y-4">
                        {recentTransactions.map((tx, index) => (
                            <div key={tx.id || index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between animate-fadeIn">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                        {tx.type === 'credit' ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            {tx.note ? tx.note.split('\n')[0] : (tx.type === 'credit' ? 'Income' : 'Expense')}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {new Date(tx.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className={`text-lg font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {tx.type === 'credit' ? '+' : '-'} {Number(tx.amount).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
