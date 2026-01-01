"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";


type LedgerEntry = {
    id?: number;
    type: "debit" | "credit";
    amount: number | string;
    categoryId: string | null;
    note: string;
    date: string;
};

type Item = {
    id: string;
    name: string;
    firstSalePrice?: number;
    secondPurchasePrice?: number;
    currentStock?: number;
    categoryId?: string;
    category?: { name: string };
};

type Party = {
    id: string;
    name: string;
    phone?: string;
    address?: string;
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
    const [partyName, setPartyName] = useState("");
    const [partyPhone, setPartyPhone] = useState("");
    const [partyAddress, setPartyAddress] = useState("");
    const [paymentType, setPaymentType] = useState<"Cash" | "Online">("Cash");
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

    // Party Search (Customer/Supplier)
    const [partySearchResults, setPartySearchResults] = useState<Party[]>([]);
    const [isSearchingParty, setIsSearchingParty] = useState(false);
    const [showPartyResults, setShowPartyResults] = useState(false);
    const partySearchRef = useRef<HTMLDivElement>(null);

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
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const saved = sessionStorage.getItem("recentTransactions");
        if (saved) {
            try {
                setRecentTransactions(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse recent transactions", e);
            }
        }
        setIsLoaded(true);

        // Fetch Next Order Number
        if (!initialData?.id) {
            fetch('/api/ledger/next-order')
                .then(res => res.json())
                .then(data => {
                    if (data.nextOrderNumber) {
                        setOrderNumber(data.nextOrderNumber.toString());
                    }
                })
                .catch(err => console.error("Failed to fetch next order number", err));
        }
    }, [initialData?.id]);

    useEffect(() => {
        if (isLoaded) {
            sessionStorage.setItem("recentTransactions", JSON.stringify(recentTransactions));
        }
    }, [recentTransactions, isLoaded]);

    const isEdit = !!initialData?.id;

    // --- Search Logic ---
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
            if (partySearchRef.current && !partySearchRef.current.contains(event.target as Node)) {
                setShowPartyResults(false);
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

    // Party Search Effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (partyName.length >= 1 && showPartyResults) {
                setIsSearchingParty(true);
                try {
                    const endpoint = type === "credit" ? "/api/customers" : "/api/suppliers";
                    const res = await fetch(`${endpoint}?search=${encodeURIComponent(partyName)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setPartySearchResults(type === "credit" ? data.customers || [] : data.suppliers || []);
                    }
                } catch (err) {
                    console.error("Failed to search party", err);
                } finally {
                    setIsSearchingParty(false);
                }
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [partyName, showPartyResults, type]);

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

    const handleSelectParty = (party: Party) => {
        setPartyName(party.name);
        setPartyPhone(party.phone || "");
        setPartyAddress(party.address || "");
        setShowPartyResults(false);
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

    const handleDeleteRecentTransaction = async (id: number) => {
        if (!confirm("Delete this transaction?")) return;
        try {
            const res = await fetch(`/api/ledger/${id}`, { method: "DELETE" });
            if (res.ok) {
                // Update local state and (implicitly) session storage via existing useEffect
                setRecentTransactions(prev => prev.filter(tx => tx.id !== id));
            } else {
                alert("Failed to delete transaction");
            }
        } catch (error) {
            console.error("Error deleting transaction:", error);
            alert("Error deleting transaction");
        }
    };

    // Receipt State
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<{
        partyName: string;
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
                if (partyName) parts.push(`${type === 'credit' ? 'Customer' : 'Supplier'}: ${partyName}`);
                if (partyPhone) parts.push(`Phone: ${partyPhone}`);
                if (partyAddress) parts.push(`Address: ${partyAddress}`);
                parts.push(`Payment: ${paymentType}`);
                parts.push(`Item: ${cartItem.item.name} (Qty: ${cartItem.quantity} @ ${cartItem.unitPrice})`);
                const finalNote = parts.join('\n');

                const payload = {
                    type,
                    amount: cartItem.amount,
                    categoryId: cartItem.item.categoryId || null,
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

            // Update Recent list
            setRecentTransactions(prev => [...results.reverse(), ...prev]);

            // Clear Form
            setCartItems([]);
            setOrderNumber("");
            setPartyName("");
            setPartyPhone("");
            setPartyAddress("");
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
        let partyName = "";
        let customerPhone = "";
        let customerAddress = "";
        let paymentType = "Cash";
        let itemName = "Item";
        let quantity = 1;
        let unitPrice = 0;

        lines.forEach(line => {
            if (line.startsWith("Order #")) orderNumber = line.replace("Order #", "").trim();
            else if (line.startsWith("Customer: ")) partyName = line.replace("Customer: ", "").trim();
            else if (line.startsWith("Supplier: ")) partyName = line.replace("Supplier: ", "").trim();
            else if (line.startsWith("Phone: ")) customerPhone = line.replace("Phone: ", "").trim();
            else if (line.startsWith("Address: ")) customerAddress = line.replace("Address: ", "").trim();
            else if (line.startsWith("Payment: ")) paymentType = line.replace("Payment: ", "").trim();
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

        return { orderNumber, partyName, customerPhone, customerAddress, paymentType, itemName, quantity, unitPrice };
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
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard?select=type')}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white group"
                            title="Back to Dashboard"
                        >
                            <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {isEdit ? "Edit Transaction" : (type === 'credit' ? 'Cash-In-Entry' : 'Cash-Out-Entry')}
                        </h2>
                    </div>

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
                            {/* Party Search */}
                            <div className="md:col-span-6 relative" ref={partySearchRef}>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    {type === 'credit' ? 'Customer' : 'Supplier'} Search
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        value={partyName}
                                        onChange={(e) => {
                                            setPartyName(e.target.value);
                                            setShowPartyResults(true);
                                        }}
                                        onFocus={() => { if (partyName.length >= 1) setShowPartyResults(true); }}
                                        placeholder={`Search ${type === 'credit' ? 'Customer' : 'Supplier'}...`}
                                        className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm"
                                    />
                                    {isSearchingParty && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </span>
                                    )}
                                    {/* Party Dropdown Results */}
                                    {showPartyResults && (
                                        <div className="absolute z-40 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-60 overflow-y-auto ring-1 ring-black/5">
                                            {isSearchingParty ? (
                                                <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                            ) : partySearchResults.length > 0 ? (
                                                <ul>
                                                    {partySearchResults.map((party) => (
                                                        <li
                                                            key={party.id}
                                                            onClick={() => handleSelectParty(party)}
                                                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm flex justify-between items-center group transition-colors border-b border-gray-50 last:border-0"
                                                        >
                                                            <span className="font-medium text-gray-700 group-hover:text-blue-600">
                                                                {party.name}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : partyName.length > 0 ? (
                                                <div className="p-4 text-center text-sm text-gray-500 flex flex-col gap-2">
                                                    <span>No {type === 'credit' ? 'customers' : 'suppliers'} found</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPartyResults(false)}
                                                        className="text-blue-600 hover:text-blue-700 text-xs font-bold"
                                                    >
                                                        + Use as Walk-in / New Name
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
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
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                if (selectedItem && e.target.value !== selectedItem.name) setSelectedItem(null);
                                            }}
                                            onFocus={() => { if (searchTerm.length >= 1) setShowResults(true); }}
                                            placeholder="Scan or Type Item..."
                                            className="w-full px-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm"
                                        />
                                        {isSearching && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            </span>
                                        )}
                                    </div>
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

                                {/* Payment Type */}
                                <div className="w-full md:w-32">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Payment</label>
                                    <select
                                        value={paymentType}
                                        onChange={(e) => setPaymentType(e.target.value as "Cash" | "Online")}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm font-semibold"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Online">Online</option>
                                    </select>
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
                                        <button type="button" onClick={handleAddOrUpdateItem} className="w-full md:w-auto px-3 bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center justify-center mb-1 gap-2 group whitespace-nowrap">
                                            <div className="bg-white/20 rounded-full p-1 group-hover:bg-white/30 transition-colors">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            </div>
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
                                {isEdit ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

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
                                    <th className="px-6 py-3">{type === 'credit' ? 'Customer' : 'Supplier'}</th>
                                    <th className="px-6 py-3">Date & Time</th>
                                    <th className="px-6 py-3">Item</th>
                                    <th className="px-6 py-3 text-center">Qty</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                    <th className="px-6 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentTransactions.map((tx, i) => {
                                    const { itemName, partyName, quantity } = parseTransactionNote(tx.note);
                                    return (
                                        <tr key={tx.id || i} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-6 py-4 font-semibold text-gray-700">
                                                {partyName || 'Walk-in'}
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
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (tx.id) window.open(`/ledger/receipt/${tx.id}`, '_blank');
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                                                        title="Open Receipt"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                        Print
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRecentTransaction(tx.id!)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition-all shadow-sm"
                                                        title="Delete Transaction"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        Del
                                                    </button>
                                                </div>
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
