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

type CartItem = {
    tempId: string;
    item: Item;
    quantity: number;
    unitPrice: number;
    amount: number;
    note?: string; // Additional details if needed
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

    // Form Fields
    const [orderNumber, setOrderNumber] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [date, setDate] = useState(
        initialData?.date
            ? new Date(initialData.date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    );
    const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));

    // Item Search
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Item[]>([]);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Current Line Item State
    const [quantity, setQuantity] = useState<string>("1");
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [lineAmount, setLineAmount] = useState<string>("");

    // Cart / Items List
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [editingCartId, setEditingCartId] = useState<string | null>(null);

    // General Form State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [recentTransactions, setRecentTransactions] = useState<LedgerEntry[]>([]);

    const isEdit = !!initialData?.id;

    // --- Search Logic ---
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
            } else if (searchTerm.length === 0) {
                setSearchResults([]);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedItem]);

    // --- Price Logic ---
    useEffect(() => {
        if (selectedItem && !editingCartId) { // Only update price automatically if not editing (or we can discuss edit logic)
            // If editing, we might want to keep the old price, but effectively we load it.
            // When selecting a NEW item:
            let price = 0;
            if (type === "credit") {
                price = Number(selectedItem.firstSalePrice || 0);
            } else {
                price = Number(selectedItem.secondPurchasePrice || 0);
            }
            setUnitPrice(price);
        }
    }, [selectedItem, type, editingCartId]);

    // Calculate Line Amount
    useEffect(() => {
        const qty = parseFloat(quantity) || 0;
        const total = (qty * unitPrice).toFixed(2);
        setLineAmount(total);
    }, [unitPrice, quantity]);

    // --- Handlers ---

    const handleSelectItem = (item: Item) => {
        setSelectedItem(item);
        setSearchTerm(item.name);
        setShowResults(false);
    };

    const handleAddOrUpdateItem = () => {
        if (!selectedItem) return;
        if (!quantity || Number(quantity) <= 0) return;
        if (!lineAmount || Number(lineAmount) <= 0) return;

        const newItem: CartItem = {
            tempId: editingCartId || Date.now().toString(),
            item: selectedItem,
            quantity: Number(quantity),
            unitPrice: unitPrice,
            amount: Number(lineAmount),
        };

        if (editingCartId) {
            setCartItems(prev => prev.map(i => i.tempId === editingCartId ? newItem : i));
            setEditingCartId(null);
        } else {
            setCartItems(prev => [...prev, newItem]);
        }

        // Reset Line Item Fields
        setSelectedItem(null);
        setSearchTerm("");
        setQuantity("1");
        setUnitPrice(0);
        setLineAmount("");
        setEditingCartId(null);
    };

    const handleEditItem = (id: string) => {
        const itemToEdit = cartItems.find(i => i.tempId === id);
        if (itemToEdit) {
            setSelectedItem(itemToEdit.item);
            setSearchTerm(itemToEdit.item.name);
            setQuantity(itemToEdit.quantity.toString());
            setUnitPrice(itemToEdit.unitPrice);
            setEditingCartId(itemToEdit.tempId);
        }
    };

    const handleDeleteItem = (id: string) => {
        setCartItems(prev => prev.filter(i => i.tempId !== id));
        if (editingCartId === id) {
            setEditingCartId(null);
            setSelectedItem(null);
            setSearchTerm("");
            setQuantity("1");
            setUnitPrice(0);
            setLineAmount("");
        }
    };

    // Receipt State
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<{
        customerName: string;
        orderNumber: string;
        date: string;
        time: string;
        items: CartItem[];
        total: number;
    } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const itemsToSave = [...cartItems];

        if (itemsToSave.length === 0 && selectedItem && Number(lineAmount) > 0) {
            itemsToSave.push({
                tempId: 'single-entry',
                item: selectedItem,
                quantity: Number(quantity),
                unitPrice: unitPrice,
                amount: Number(lineAmount),
            });
        }

        if (itemsToSave.length === 0) {
            setError("Please add at least one item or fill the transaction details.");
            setLoading(false);
            return;
        }

        try {
            const dateTime = new Date(`${date}T${time}`);
            const promises = itemsToSave.map(cartItem => {
                const parts = [];
                if (orderNumber) parts.push(`Order #${orderNumber}`);
                if (customerName) parts.push(`Customer: ${customerName}`);
                parts.push(`Item: ${cartItem.item.name} (Qty: ${cartItem.quantity} @ ${cartItem.unitPrice})`);
                const finalNote = parts.join('\n');

                const payload = {
                    type,
                    amount: cartItem.amount,
                    categoryId: null,
                    note: finalNote,
                    date: dateTime.toISOString(),
                };

                const url = isEdit && itemsToSave.length === 1 ? `/api/ledger/${initialData!.id}` : "/api/ledger";
                const method = isEdit && itemsToSave.length === 1 ? "PUT" : "POST";

                return fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }).then(async res => {
                    if (!res.ok) {
                        const d = await res.json();
                        throw new Error(d.error || "Failed");
                    }
                    return res.json();
                });
            });

            const results = await Promise.all(promises);

            // Set Receipt Data BEFORE clearing state
            setReceiptData({
                customerName,
                orderNumber,
                date,
                time,
                items: itemsToSave,
                total: itemsToSave.reduce((sum, item) => sum + item.amount, 0)
            });
            setShowReceipt(true);

            // Update Recent list
            setRecentTransactions(prev => [...results.reverse(), ...prev]);

            // Clear Form
            setCartItems([]);
            setOrderNumber("");
            setCustomerName("");
            setSelectedItem(null);
            setSearchTerm("");
            setQuantity("1");
            setUnitPrice(0);
            setLineAmount("");

            // Note: We stay on the page to show the receipt, so no router.back() here unless New Transaction is clicked.
            setLoading(false);

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unexpected error occurred");
            }
            setLoading(false);
        }
    };

    // Helper to parse existing notes for printing
    const parseTransactionNote = (note: string) => {
        const lines = note.split('\n');
        let orderNumber = "";
        let customerName = "";
        let itemName = "Item";
        let quantity = 1;
        let unitPrice = 0;

        lines.forEach(line => {
            if (line.startsWith("Order #")) orderNumber = line.replace("Order #", "").trim();
            else if (line.startsWith("Customer: ")) customerName = line.replace("Customer: ", "").trim();
            else if (line.startsWith("Item: ")) {
                // Item: Name (Qty: X @ Y)
                const match = line.match(/Item: (.*) \(Qty: (\d+) @ (.*)\)/);
                if (match) {
                    itemName = match[1];
                    quantity = Number(match[2]);
                    unitPrice = Number(match[3]);
                } else {
                    itemName = line.replace("Item: ", "").trim();
                }
            }
        });

        return { orderNumber, customerName, itemName, quantity, unitPrice };
    };

    const handlePrintHistory = (tx: LedgerEntry) => {
        const { orderNumber, customerName, itemName, quantity, unitPrice } = parseTransactionNote(tx.note);

        // Reconstruct item for receipt
        const item: CartItem = {
            tempId: tx.id?.toString() || 'history',
            item: { id: 'history', name: itemName },
            quantity: quantity,
            unitPrice: unitPrice || Number(tx.amount), // Fallback if parse fails
            amount: Number(tx.amount)
        };

        setReceiptData({
            customerName,
            orderNumber,
            date: tx.date.split('T')[0],
            time: new Date(tx.date).toLocaleTimeString(),
            items: [item],
            total: Number(tx.amount)
        });
        setShowReceipt(true);
    };

    // Calculate Grand Total
    const grandTotal = cartItems.reduce((acc, curr) => acc + curr.amount, 0) + ((itemsToSave => itemsToSave.length === 0 && selectedItem ? Number(lineAmount) : 0)(cartItems));
    const displayTotal = cartItems.reduce((acc, curr) => acc + curr.amount, 0);

    // --- Render Receipt View ---
    // Scroll to receipt when it appears
    const receiptRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (showReceipt && receiptRef.current) {
            receiptRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [showReceipt]);

    return (
        <div className="w-full min-h-[85vh] flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex-1 flex flex-col print:hidden">
                {/* Header Row */}
                <div className={`px-8 py-5 ${type === 'credit' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-gradient-to-r from-red-600 to-red-500'} flex flex-wrap items-center justify-between gap-4`}>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {isEdit ? "Edit Transaction" : (type === 'credit' ? 'Credit Sale Entry' : 'Debit Entry')}
                    </h2>

                    {/* Row 1: Order Number */}
                    <div className="flex items-center gap-3">
                        <label className="text-white/90 text-sm font-semibold">Order #</label>
                        <input
                            type="text"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            className="bg-white/20 border border-white/30 text-white placeholder-white/70 text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/50 w-36 transition-all"
                            placeholder="Auto"
                        />
                    </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                    {error && (
                        <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl border border-gray-100 flex items-center shadow-sm animate-pulse-fast">
                            <span className="mr-2 text-xl">⚠️</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2">

                        {/* Row 2: Customer Name | Date | Time */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Customer Search */}
                            <div className="md:col-span-6 relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Customer / Payee</label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Search Customer..."
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Date */}
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm"
                                />
                            </div>

                            {/* Time */}
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Time</label>
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Row 3: Item Search | Qty | Amount | Actions */}
                        {/* Removed background, added equal spacing */}
                        <div className="pt-2"> {/* Optional spacing wrapper */}
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                {/* Item Search */}
                                <div className="w-full md:flex-1 relative" ref={searchRef}>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Item Search</label>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            if (selectedItem && e.target.value !== selectedItem.name) setSelectedItem(null);
                                        }}
                                        onFocus={() => { if (searchTerm.length >= 1) setShowResults(true); }}
                                        placeholder="Scan or Type Item..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm"
                                    />
                                    {/* Dropdown Results */}
                                    {showResults && (
                                        <div className="absolute z-30 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-60 overflow-y-auto ring-1 ring-black/5">
                                            {isSearching ? <div className="p-4 text-center text-sm text-gray-500">Searching...</div> :
                                                searchResults.length > 0 ? (
                                                    <ul>{searchResults.map(item => (
                                                        <li key={item.id} onClick={() => handleSelectItem(item)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm flex justify-between items-center group transition-colors border-b border-gray-50 last:border-0">
                                                            <span className="font-medium text-gray-700 group-hover:text-blue-600">{item.name}</span>
                                                            <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">{item.category?.name}</span>
                                                        </li>
                                                    ))}</ul>
                                                ) : <div className="p-4 text-center text-sm text-gray-500">No items found</div>}
                                        </div>
                                    )}
                                </div>

                                {/* Qty */}
                                <div className="w-full md:w-32">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Qty</label>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm font-semibold text-center"
                                    />
                                </div>

                                {/* Amount */}
                                <div className="w-full md:w-56">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rs.</span>
                                        <input
                                            type="number"
                                            value={lineAmount}
                                            onChange={(e) => setLineAmount(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm font-bold text-lg text-gray-800"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="w-full md:w-auto md:shrink-0 flex items-end justify-end">
                                    {editingCartId ? (
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button type="button" onClick={handleAddOrUpdateItem} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium text-sm transition-all shadow-md active:scale-95 whitespace-nowrap">
                                                Update
                                            </button>
                                            <button type="button" onClick={() => {
                                                setEditingCartId(null);
                                                setSelectedItem(null);
                                                setSearchTerm("");
                                                setQuantity("1");
                                                setUnitPrice(0);
                                                setLineAmount("");
                                            }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-3 rounded-xl transition-all shadow-sm">
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={handleAddOrUpdateItem} className="w-full md:w-auto px-8 bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 group whitespace-nowrap">
                                            <div className="bg-white/20 rounded-full p-1 group-hover:bg-white/30 transition-colors">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            </div>
                                            ADD ITEM
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Cart Items List */}
                        {cartItems.length > 0 && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-sm text-left min-w-[600px]">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-3">Item</th>
                                            <th className="px-4 py-3 text-center">Qty</th>
                                            <th className="px-4 py-3 text-right">Price</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                            <th className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {cartItems.map((item) => (
                                            <tr key={item.tempId} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-800">{item.item.name}</td>
                                                <td className="px-4 py-3 text-center">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right text-gray-500">{item.unitPrice}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-800">{item.amount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-center space-x-2">
                                                    <button type="button" onClick={() => handleEditItem(item.tempId)} className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-100 rounded">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteItem(item.tempId)} className="text-red-600 hover:text-red-800 p-1 hover:bg-red-100 rounded">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t border-gray-100">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-600">Total:</td>
                                            <td className="px-4 py-3 text-right font-bold text-lg text-emerald-600">{displayTotal.toLocaleString()}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Bottom Right SAVE OPTIONS */}
                        <div className="flex justify-end pt-4 gap-3 mt-auto">
                            {/* Optional: Print or other options */}
                            {/* <button type="button" className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">draft</button> */}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full md:w-auto px-8 py-3 rounded-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}
                            >
                                {loading && <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                                {isEdit ? 'Update Transaction' : 'Save Transaction'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* RECEIPT VIEW (Appears at Bottom - Thermal Printer Style) */}
            {showReceipt && receiptData && (
                <div ref={receiptRef} className="mt-8 mb-16 animate-slide-in-up flex flex-col items-center">
                    {/* Thermal Receipt Container */}
                    <div className="bg-white p-4 shadow-xl max-w-[350px] w-full print:shadow-none print:max-w-none print:w-[80mm] print:mx-auto font-mono text-xs font-bold uppercase text-black leading-tight">

                        {/* Header */}
                        <div className="flex flex-col items-center mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-6 h-6 text-black transform -rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                <h1 className="text-xl font-black tracking-tight">Moon Traders</h1>
                            </div>
                            <p className="text-[10px] tracking-widest border-b border-black w-full text-center pb-1 mb-1">PURCHASE ORDER</p>
                            <div className="w-full border-t border-black"></div>
                        </div>

                        {/* QR Code */}
                        <div className="flex justify-center mb-6">
                            <div className="p-1">
                                <div className="w-24 h-24 bg-black/10 flex items-center justify-center border-2 border-black/10">
                                    <svg className="w-24 h-24 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 15h6v6H3v-6zm2 2v2h2v-2H5zm13-2h3v2h-3v-2zm-3 2h2v2h-2v-2zm-3 2h2v2h-2v-2zm3 2h3v2h-3v-2zM15 3h2v2h-2V3zm-6 8h2v2H9v-2zm6 0h2v2h-2v-2zm-6 4h2v2H9v-2zm2-2h2v2h-2v-2zm-4 4H5v2h2v-2z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Date / Time / Status */}
                        <div className="mb-3 space-y-1.5 font-bold">
                            <div className="flex justify-between">
                                <span>Date:</span>
                                <span>{new Date(receiptData.date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Time:</span>
                                <span>{receiptData.time}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Status:</span>
                                <span>RECEIVED</span>
                            </div>
                        </div>

                        <div className="border-b border-black mb-3"></div>

                        {/* Customer Info */}
                        <div className="mb-3 space-y-1.5 font-bold">
                            <div className="flex justify-between">
                                <span>Name:</span>
                                <span className="text-right max-w-[65%] truncate">{receiptData.customerName || 'Walk-in'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Contact:</span>
                                <span>{receiptData.orderNumber || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Detail:</span>
                                <span className="text-right max-w-[65%] truncate">-</span>
                            </div>
                        </div>

                        <div className="border-b border-black mb-1"></div>
                        <div className="border-b border-black mb-3"></div>

                        {/* Items Table */}
                        <table className="w-full mb-3">
                            <thead>
                                <tr className="text-left border-b border-black">
                                    <th className="pb-2 w-[35%]">ITEM</th>
                                    <th className="pb-2 text-center w-[15%]">QTY</th>
                                    <th className="pb-2 text-right w-[20%]">PRICE</th>
                                    <th className="pb-2 text-right w-[30%]">AMT</th>
                                </tr>
                            </thead>
                            <tbody className="">
                                {receiptData.items.map((item, idx) => (
                                    <tr key={idx} className="align-top">
                                        <td className="py-1.5 pr-1 font-bold truncate max-w-[80px]">{item.item.name}</td>
                                        <td className="py-1.5 text-center">{item.quantity}</td>
                                        <td className="py-1.5 text-right">{item.unitPrice.toFixed(2)}</td>
                                        <td className="py-1.5 text-right">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-t border-black mb-1"></div>
                        <div className="border-t border-black mb-3"></div>

                        {/* Totals */}
                        <div className="flex justify-between items-center text-sm font-black mb-3">
                            <span>TOTAL</span>
                            <span>PKR {receiptData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="border-b border-black mb-3"></div>

                        {/* Notes & Terms */}
                        <div className="mb-6 space-y-2 font-bold">
                            <div className="flex justify-between">
                                <span>Notes:</span>
                                <span className="text-right">something</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Terms:</span>
                                <span className="text-right">nothing</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-[10px] mb-6 flex items-center justify-center gap-2">
                            <span>- - -</span> <span>END</span> <span>- - -</span>
                        </div>

                        {/* On-Screen Only Actions */}
                        <div className="print:hidden flex flex-col gap-2 mt-4 border-t border-gray-200 pt-4">
                            <button
                                onClick={() => window.print()}
                                className="w-full bg-black text-white py-2 rounded font-bold hover:bg-gray-800 transition-colors"
                            >
                                Print Receipt
                            </button>
                            <button
                                onClick={() => { setShowReceipt(false); setReceiptData(null); }}
                                className="w-full bg-gray-200 text-black py-2 rounded font-bold hover:bg-gray-300 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Transactions (Detailed Table) */}
            {recentTransactions.length > 0 && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col print:hidden mt-4 mb-12">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-800">Recent Transactions</h3>
                        <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">Session History</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-3">Customer</th>
                                    <th className="px-6 py-3">Date & Time</th>
                                    <th className="px-6 py-3">Item</th>
                                    <th className="px-6 py-3 text-center">Qty</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                    <th className="px-6 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentTransactions.map((tx, i) => {
                                    const { itemName, customerName, quantity } = parseTransactionNote(tx.note);
                                    return (
                                        <tr key={tx.id || i} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-6 py-4 font-semibold text-gray-700">
                                                {customerName || 'Walk-in'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                <div>{new Date(tx.date).toLocaleDateString()}</div>
                                                <div className="text-xs text-gray-400">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-900 font-medium">
                                                {itemName}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-600">
                                                {quantity}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {Number(tx.amount).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handlePrintHistory(tx)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                                                    title="Print Receipt"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                    Print
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
