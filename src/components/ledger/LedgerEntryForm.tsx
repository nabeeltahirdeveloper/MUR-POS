"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAlert } from "@/contexts/AlertContext";


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
    ledgerId?: string; // ID of the existing ledger entry if editing
    item: Item;
    quantity: number;
    unitPrice: number;
    amount: number;
    note?: string; // Additional details if needed
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
    let itemType = "Stock";
    let quantity = 1;
    let unitPrice = 0;
    let advance: number | undefined = undefined;
    let remaining: number | undefined = undefined;

    lines.forEach(line => {
        if (line.startsWith("Order #")) orderNumber = line.replace("Order #", "").trim();
        else if (line.startsWith("Customer: ")) partyName = line.replace("Customer: ", "").trim();
        else if (line.startsWith("Supplier: ")) partyName = line.replace("Supplier: ", "").trim();
        else if (line.startsWith("Phone: ")) customerPhone = line.replace("Phone: ", "").trim();
        else if (line.startsWith("Address: ")) customerAddress = line.replace("Address: ", "").trim();
        else if (line.startsWith("Payment: ")) paymentType = line.replace("Payment: ", "").trim();
        else if (line.startsWith("Advance: ")) advance = Number(line.replace("Advance: ", "").trim());
        else if (line.startsWith("Remaining: ")) remaining = Number(line.replace("Remaining: ", "").trim());
        else if (line.startsWith("Item: ")) {
            // Item: [Type] Name (Qty: X @ Y) - Handle optional space after ]
            const match = line.match(/Item: (?:\[(.*?)\]\s*)?(.*?)\s*\(Qty: (\d+)\s*@\s*(.*)\)/);
            if (match) {
                itemType = match[1] || "Stock";
                itemName = match[2];
                quantity = Number(match[3]);
                unitPrice = Number(match[4]);
            } else {
                itemName = line.replace("Item: ", "").trim();
            }
        }
    });

    return { orderNumber, partyName, customerPhone, customerAddress, paymentType, itemName, itemType, quantity, unitPrice, advance, remaining };
};

export default function LedgerEntryForm({
    initialData,
}: {
    initialData?: LedgerEntry;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showConfirm, showAlert } = useAlert();
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
    const [isNewParty, setIsNewParty] = useState(false);
    const partySearchRef = useRef<HTMLDivElement>(null);

    // Current Line Item State
    const [quantity, setQuantity] = useState<string>("1");
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [lineAmount, setLineAmount] = useState<string>("");
    const [itemType, setItemType] = useState<"Stock" | "Customize">("Stock");

    // Payment Details State
    const [advanceAmount, setAdvanceAmount] = useState<string>("");
    const [remainingAmount, setRemainingAmount] = useState<number>(0);

    // Cart / Items List
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [editingCartId, setEditingCartId] = useState<string | null>(null);
    const [originalBatchIds, setOriginalBatchIds] = useState<string[]>([]); // Track IDs for deletion handling

    // Stock Validation Modal State
    const [stockErrorModal, setStockErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" });

    // General Form State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);


    // --- Initialize from existing data (Edit Mode) ---
    useEffect(() => {
        if (initialData?.id) {
            const parsed = parseTransactionNote(initialData.note || "");

            // Common setup
            setPartyName(parsed.partyName);
            setPartyPhone(parsed.customerPhone);
            setPartyAddress(parsed.customerAddress);
            setPaymentType(parsed.paymentType as any);
            if (parsed.advance != null) setAdvanceAmount(String(parsed.advance));

            if (parsed.orderNumber) {
                setOrderNumber(parsed.orderNumber);
                // Fetch Siblings to reconstruct the whole bill
                const fetchSiblings = async () => {
                    // Don't set full loading to avoid flickering whole page if possible, but safer to block interaction
                    // setLoading(true); 
                    try {
                        const res = await fetch(`/api/ledger?search=Order #${parsed.orderNumber}&limit=100`);
                        if (res.ok) {
                            const data = await res.json();
                            // Ensure exact order number match
                            const siblings = (data.data || []).filter((e: any) => {
                                const subParsed = parseTransactionNote(e.note || "");
                                return subParsed.orderNumber === parsed.orderNumber;
                            });

                            const batchItems: CartItem[] = siblings.map((e: any) => {
                                const p = parseTransactionNote(e.note || "");
                                return {
                                    tempId: e.id.toString(),
                                    ledgerId: e.id,
                                    item: {
                                        id: e.itemId || 'unknown',
                                        name: p.itemName,
                                        firstSalePrice: p.unitPrice,
                                        categoryId: e.categoryId,
                                    },
                                    quantity: p.quantity,
                                    unitPrice: p.unitPrice,
                                    amount: Number(e.amount),
                                    note: p.itemType
                                };
                            });

                            setCartItems(batchItems);
                            setOriginalBatchIds(siblings.map((e: any) => e.id));
                        }
                    } catch (err) {
                        console.error("Failed to fetch batch siblings", err);
                    }
                };
                fetchSiblings();
            } else {
                // Single Item 
                const reconstructItem: CartItem = {
                    tempId: Date.now().toString(),
                    ledgerId: String(initialData.id),
                    item: {
                        id: 'unknown',
                        name: parsed.itemName,
                        firstSalePrice: parsed.unitPrice,
                        categoryId: initialData.categoryId || undefined,
                    },
                    quantity: parsed.quantity,
                    unitPrice: parsed.unitPrice,
                    amount: Number(initialData.amount),
                    note: parsed.itemType
                };
                setCartItems([reconstructItem]);
                setOriginalBatchIds([String(initialData.id)]);
            }
        } else {
            // Fetch Next Order Number only if NEW entry
            fetch('/api/ledger/next-order')
                .then(res => res.json())
                .then(data => {
                    if (data.nextOrderNumber) {
                        setOrderNumber(data.nextOrderNumber.toString());
                    }
                })
                .catch(err => console.error("Failed to fetch next order number", err));
        }
    }, [initialData]);

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
            if (partyName.length >= 1 && showPartyResults && !isNewParty) {
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
            // When selecting a NEW item, always default to Sale Price as requested
            let price = Number(selectedItem.firstSalePrice || 0);
            setUnitPrice(price);
        }
    }, [selectedItem, editingCartId]);

    // Calculate Line Amount
    useEffect(() => {
        const qty = parseFloat(quantity) || 0;
        const total = (qty * unitPrice).toFixed(2);
        setLineAmount(total);
    }, [unitPrice, quantity]);

    // Calculate Grand Total and update Remaining
    // Calculate Grand Total and update Remaining
    // We must include the current line item if it's being edited or typed but not added yet, 
    // IF the user intends for "Advance" to apply to the whole expected bill.
    // However, typically 'displayTotal' is just Cart. 
    // If the user wants to calculate against the *Current Item* as well (Single Entry flow), we should include it.
    const currentLineValue = parseFloat(lineAmount) || 0;
    // If we are editing an item, its old value is in cart, so we should subtract old and add new? 
    // Complexity! Simply: `displayTotal` is strictly CART items.
    // If the user is typing a new item, it's NOT in `displayTotal`. 
    // The user wants the Remaining to reflect (Cart + CurrentItem) - Advance.

    // Logic: If there are cart items, use cart items. If cart is empty, use current line item. 
    // BETTER Logic: Use (Cart Items + Current Item Amount (if valid item selected)).
    // BUT: Does the user want `Remaining` to change as they type quantity? Yes.

    // Correct logic for "Total Bill Value" currently on screen:
    // If editingCartId -> exclude that item from cart sum, add current `lineAmount`.
    // Else -> add `lineAmount` to cart sum.

    const effectiveTotal = useMemo(() => {
        let total = 0;
        if (editingCartId) {
            total = cartItems.reduce((acc, curr) => curr.tempId === editingCartId ? acc : acc + curr.amount, 0);
            total += currentLineValue;
        } else {
            total = cartItems.reduce((acc, curr) => acc + curr.amount, 0);
            // Only add current line value if there's a selected item, otherwise it might be just noise?
            // Actually if they typed quantity and price, it's valid potential amount.
            if (selectedItem) {
                total += currentLineValue;
            }
        }
        return total;
    }, [cartItems, editingCartId, currentLineValue, selectedItem]);

    const displayTotal = cartItems.reduce((acc, curr) => acc + curr.amount, 0); // Keep for Table Footer

    useEffect(() => {
        if (advanceAmount === "") {
            setRemainingAmount(effectiveTotal);
        } else {
            setRemainingAmount(effectiveTotal - Number(advanceAmount));
        }
    }, [effectiveTotal, advanceAmount]);

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
        // For Stock items, selectedItem is required.
        // For Customize items, selectedItem can be null if searchTerm is provided.
        if (!selectedItem && (itemType !== 'Customize' || !searchTerm.trim())) return;
        if (!quantity || Number(quantity) <= 0) return;
        if (!lineAmount || Number(lineAmount) <= 0) return;

        // Stock Validation Implementation
        // Only apply stock check for Cash-In (type === 'credit') as this represents a Sale (Stock Out)
        // SKIP IF CUSTOMIZE
        if (type === 'credit' && itemType === 'Stock') {
            const currentStock = selectedItem.currentStock || 0;

            // Calculate quantity already in cart for this specific item (excluding current edit item)
            // Also ensure we only count 'Stock' items in cart against inventory? Assuming yes.
            const existingInCart = cartItems
                .filter(item => item.item.id === selectedItem.id && item.tempId !== editingCartId && (!item.note || item.note === 'Stock'))
                .reduce((sum, item) => sum + item.quantity, 0);

            const availableStock = currentStock - existingInCart;
            const requestedQty = Number(quantity);

            // Case 1: No available stock (exhausted by cart or empty)
            if (availableStock <= 0) {
                setStockErrorModal({
                    open: true,
                    message: existingInCart > 0
                        ? `You have already added all available stock(${currentStock}) to the cart!`
                        : "This item is currently out of stock!"
                });
                return;
            }

            // Case 2: Insufficient Stock for new request
            if (requestedQty > availableStock) {
                setStockErrorModal({
                    open: true,
                    message: `Only ${availableStock} item(s) are remaining in stock! Please decrease the quantity.` + (existingInCart > 0 ? `(You have ${existingInCart} in cart)` : "")
                });
                return;
            }
        }

        let itemToAdd = selectedItem;

        // Custom Item Logic
        if (itemType === 'Customize' && !selectedItem && searchTerm.trim().length > 0) {
            itemToAdd = {
                id: 'unknown',
                name: searchTerm.trim(),
                categoryId: undefined
            };
        }

        if (!itemToAdd) return;

        const newItem: CartItem = {
            tempId: editingCartId || Date.now().toString(),
            item: itemToAdd,
            quantity: Number(quantity),
            unitPrice: unitPrice,
            amount: Number(lineAmount),
            note: itemType,
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
        setItemType("Stock"); // Reset to default
        setEditingCartId(null);
    };

    const handleEditItem = (id: string) => {
        const itemToEdit = cartItems.find(i => i.tempId === id);
        if (itemToEdit) {
            setSelectedItem(itemToEdit.item);
            setSearchTerm(itemToEdit.item.name);
            setQuantity(itemToEdit.quantity.toString());
            setUnitPrice(itemToEdit.unitPrice);
            if (itemToEdit.note === 'Customize' || itemToEdit.note === 'Stock') {
                setItemType(itemToEdit.note as "Stock" | "Customize");
            }
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
            setItemType("Stock");
        }
    };

    const handleDeleteRecentTransaction = async (id: number) => {
        if (!await showConfirm("Delete this transaction?", { variant: "danger" })) return;

        // Try to find the order number from the transaction we're about to delete
        const txToDelete = recentTransactions.find(tx => tx.id === id);
        const orderNum = txToDelete?.orderNumber;

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

                // Update local state and (implicitly) session storage via existing useEffect
                setRecentTransactions(prev => prev.filter(tx => tx.id !== id));
            } else {
                await showAlert("Failed to delete transaction", { variant: "danger", title: "Error" });
            }
        } catch (error) {
            console.error("Error deleting transaction:", error);
            await showAlert("Error deleting transaction", { variant: "danger", title: "Error" });
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

    // --- Hidden Price Logic ---
    const [showPinInput, setShowPinInput] = useState(false);
    const [pinValue, setPinValue] = useState("");
    const [isPriceRevealed, setIsPriceRevealed] = useState(false);

    const handleAmountLabelClick = () => {
        if (isPriceRevealed) {
            setIsPriceRevealed(false);
            setPinValue("");
            setShowPinInput(false);
        } else {
            setShowPinInput(!showPinInput);
            setPinValue(""); // Reset input on toggle
        }
    };

    const handlePinSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (pinValue === '1122') {
                setIsPriceRevealed(true);
                setShowPinInput(false);
            } else {
                showAlert('Invalid PIN', { variant: "warning" }); // Simple feedback
                setPinValue("");
            }
        }
    };

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

            // Handle New Party Creation
            if (isNewParty && partyName) {
                const endpoint = type === 'credit' ? '/api/customers' : '/api/suppliers';
                const partyRes = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: partyName,
                        phone: partyPhone,
                        address: partyAddress
                    })
                });
                if (!partyRes.ok) {
                    const d = await partyRes.json();
                    throw new Error(d.error || `Failed to create ${type === 'credit' ? 'customer' : 'supplier'} `);
                }
                // Party created successfully
            }

            // Identify Deletions (if editing a batch)
            const currentLedgerIds = itemsToSave.map(i => i.ledgerId).filter(Boolean);
            const idsToDelete = originalBatchIds.filter(id => !currentLedgerIds.includes(id));

            const deletePromises = idsToDelete.map(id =>
                fetch(`/api/ledger/${id}`, { method: 'DELETE' })
                    .then(res => { if (!res.ok) throw new Error("Failed to delete removed item"); return res.json(); })
            );

            const savePromises = itemsToSave.map(cartItem => {
                const parts = [];
                if (orderNumber) parts.push(`Order #${orderNumber} `);
                if (partyName) parts.push(`${type === 'credit' ? 'Customer' : 'Supplier'}: ${partyName} `);
                if (partyPhone) parts.push(`Phone: ${partyPhone} `);
                if (partyAddress) parts.push(`Address: ${partyAddress} `);
                parts.push(`Payment: ${paymentType} `);

                // Item Note: [Stock/Customize] Item Name (Qty...)
                const typePrefix = cartItem.note ? `[${cartItem.note}] ` : "";
                parts.push(`Item: ${typePrefix}${cartItem.item.name} (Qty: ${cartItem.quantity} @${cartItem.unitPrice})`);

                // Add Advance & Remaining to ALL items in the batch so they are searchable/filterable
                if (advanceAmount !== "") parts.push(`Advance: ${advanceAmount} `);
                if (remainingAmount !== undefined) parts.push(`Remaining: ${remainingAmount} `);

                const finalNote = parts.join('\n');

                const payload = {
                    type,
                    amount: cartItem.amount,
                    categoryId: cartItem.item.categoryId || null,
                    itemId: cartItem.item.id !== 'unknown' ? cartItem.item.id : undefined,
                    quantity: cartItem.quantity,
                    note: finalNote,
                    date: dateTime.toISOString(),
                };

                let url = "/api/ledger";
                let method = "POST";

                if (cartItem.ledgerId) {
                    url = `/api/ledger/${cartItem.ledgerId}`;
                    method = "PUT";
                }

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

            const results = await Promise.all([...deletePromises, ...savePromises]);

            // --- Sync with Debts ---
            // --- Sync with Debts ---
            // DISABLED: User requested to separate Pending Payments from Loans.
            // Remaining balance will now ONLY be tracked via Ledger Note "Remaining: X"
            // and displayed in Pending Payments view, NOT in Loans view.
            /*
            if (orderNumber && partyName) {
                try {
                    const debtsRes = await fetch('/api/debts');
                    if (debtsRes.ok) {
                        const debts = await debtsRes.json();
                        const existingDebt = debts.find((d: any) => d.note?.includes(`Order #${orderNumber}`));

                        const debtType = type === 'credit' ? 'loaned_out' : 'loaned_in';
                        const debtAmount = remainingAmount || 0;

                        if (debtAmount > 0) {
                            const debtPayload = {
                                personName: partyName,
                                type: debtType,
                                amount: debtAmount,
                                note: `${type === 'credit' ? 'Customer' : 'Supplier'}: Bill Order #${orderNumber}`,
                                status: 'active'
                            };

                            if (existingDebt) {
                                await fetch(`/api/debts/${existingDebt.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(debtPayload)
                                });
                            } else {
                                await fetch('/api/debts', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(debtPayload)
                                });
                            }
                        } else if (existingDebt) {
                            // Close the debt if remaining is 0
                            await fetch(`/api/debts/${existingDebt.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'closed', amount: 0 })
                            });
                        }
                    }
                } catch (debtErr) {
                    console.error("Failed to sync debt:", debtErr);
                }
            }
            */

            // Filter out delete results (usually {success: true}) from bill reconstruction
            // Actually, keep it simple: we only care about saved items for receipt
            // The results array will contain responses for deletes and saves.
            // We need to isolate the saved items to show receipt.

            // Re-fetch or use results that are from saves?
            // Results are mixed.
            // Let's rely on itemsToSave as the source of truth for the receipt.

            const billData = {
                id: results[0]?.id || `batch - ${Date.now()} `,
                allIds: currentLedgerIds.join(','), // simplified
                items: itemsToSave.map(item => ({
                    ...parseTransactionNote(""), // defaults
                    itemName: item.item.name,
                    itemType: item.note || 'Stock',
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    amount: item.amount,
                })),
                total: itemsToSave.reduce((acc, r) => acc + Number(r.amount), 0),
                date: dateTime.toISOString(),
                partyName: partyName || "Walk-in",
                orderNumber: orderNumber,
                type: type // credit/debit
            };

            // Update Recent list
            setRecentTransactions(prev => [billData, ...prev]);

            // Clear Form
            setCartItems([]);
            setOrderNumber("");
            setPartyName("");
            setPartyPhone("");
            setPartyAddress("");
            setIsNewParty(false);
            setSelectedItem(null);
            setSearchTerm("");
            setQuantity("1");
            setUnitPrice(0);
            setLineAmount("");
            setAdvanceAmount("");
            setRemainingAmount(0);
            setOriginalBatchIds([]);

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





    // Calculate Grand Total
    const grandTotal = cartItems.reduce((acc, curr) => acc + curr.amount, 0) + ((itemsToSave => itemsToSave.length === 0 && selectedItem ? Number(lineAmount) : 0)(cartItems));
    // displayTotal already defined above

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
                <div className="px-8 py-6 bg-slate-900 border-b border-primary/20 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard?select=type')}
                            className="p-2.5 bg-slate-800 hover:bg-primary hover:text-slate-900 rounded-xl transition-all text-primary group border border-primary/10 cursor-pointer"
                            title="Back to Dashboard"
                        >
                            <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div>
                            <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                {isEdit ? "Edit Transaction" : (type === 'credit' ? 'Cash-In-Entry' : 'Cash-Out-Entry')}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-widest ${type === 'credit' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'} `}>
                                    {type === 'credit' ? 'Cash-In' : 'Cash-Out'}
                                </span>
                            </h2>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Moon Traders • Ledger System</p>
                        </div>
                    </div>

                    {/* Row 1: Order Number */}
                    <div className="flex items-center gap-4 bg-slate-800/50 p-2 rounded-xl border border-white/5">
                        <label className="text-slate-400 text-[10px] font-black uppercase tracking-tighter pl-2">Voucher #</label>
                        <input
                            type="text"
                            value={orderNumber || "---"}
                            readOnly
                            className="bg-slate-900 border border-primary/30 !text-primary font-black text-sm rounded-lg px-4 py-2 w-32 text-center focus:outline-none cursor-default shadow-[0_0_15px_rgba(79,209,197,0.1)]"
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

                        {/* Row 2: Customer Name | Item Type | Date | Time */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Party Search */}
                            <div className="md:col-span-4 relative" ref={partySearchRef}>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    {type === 'credit' ? 'Customer' : 'Supplier'} Search
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-primary transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        value={partyName}
                                        onChange={(e) => {
                                            setPartyName(e.target.value);
                                            if (!isNewParty) setShowPartyResults(true);
                                        }}
                                        onFocus={() => { if (partyName.length >= 1 && !isNewParty) setShowPartyResults(true); }}
                                        placeholder={`Search ${type === 'credit' ? 'Customer' : 'Supplier'}...`}
                                        className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm text-gray-900"
                                    />
                                    {isSearchingParty && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </span>
                                    )}
                                    {isNewParty && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsNewParty(false);
                                                setPartyName("");
                                                setPartyPhone("");
                                                setPartyAddress("");
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 cursor-pointer"
                                            title="Cancel New Party"
                                        >
                                            ✕
                                        </button>
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
                                                            className="px-4 py-3 hover:bg-primary/10 cursor-pointer text-sm flex justify-between items-center group transition-colors border-b border-gray-50 last:border-0"
                                                        >
                                                            <span className="font-medium text-gray-700 group-hover:text-primary">
                                                                {party.name}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : partyName.length > 0 && !isNewParty ? (
                                                <div className="p-4 text-center text-sm text-gray-500 flex flex-col gap-2">
                                                    <span>No {type === 'credit' ? 'customers' : 'suppliers'} found</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsNewParty(true);
                                                            setShowPartyResults(false);
                                                        }}
                                                        className="text-primary hover:text-primary-dark text-xs font-bold cursor-pointer"
                                                    >
                                                        + Create New {type === 'credit' ? 'Customer' : 'Supplier'}
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                {isNewParty && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phone Number</label>
                                            <input
                                                type="text"
                                                value={partyPhone}
                                                onChange={(e) => setPartyPhone(e.target.value)}
                                                placeholder="Enter phone..."
                                                className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm text-gray-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Address</label>
                                            <input
                                                type="text"
                                                value={partyAddress}
                                                onChange={(e) => setPartyAddress(e.target.value)}
                                                placeholder="Enter address..."
                                                className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm text-gray-900"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Items Type - Moved Here */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Item Type</label>
                                <select
                                    value={itemType}
                                    onChange={(e) => setItemType(e.target.value as "Stock" | "Customize")}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm font-semibold text-gray-900"
                                >
                                    <option value="Stock">Stock</option>
                                    <option value="Customize">Customize</option>
                                </select>
                            </div>

                            {/* Date */}
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm text-gray-900"
                                />
                            </div>

                            {/* Time */}
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Time</label>
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm text-gray-900"
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
                                            className="w-full px-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm text-gray-900"
                                        />
                                        {isSearching && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                                                        <li key={item.id} onClick={() => handleSelectItem(item)} className="px-4 py-3 hover:bg-primary/10 cursor-pointer text-sm flex justify-between items-center group transition-colors border-b border-gray-50 last:border-0">
                                                            <span className="font-medium text-gray-700 group-hover:text-primary">{item.name}</span>
                                                            <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-500 group-hover:bg-primary/20 group-hover:text-primary-dark transition-colors">{item.category?.name}</span>
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
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm font-semibold text-gray-900"
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
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm font-semibold text-center text-gray-900"
                                    />
                                </div>

                                {/* Amount */}
                                <div className="w-full md:w-56">
                                    <div className="flex justify-between items-center mb-2">
                                        <label
                                            onClick={handleAmountLabelClick}
                                            className="text-xs font-bold text-gray-500 uppercase cursor-pointer hover:text-primary transition-colors select-none"
                                        >
                                            Amount
                                        </label>

                                        {/* Hidden Price Reveal UI */}
                                        <div className="h-4 flex items-center justify-end">
                                            {showPinInput && (
                                                <input
                                                    autoFocus
                                                    type="password"
                                                    value={pinValue}
                                                    onChange={(e) => setPinValue(e.target.value)}
                                                    onKeyDown={handlePinSubmit}
                                                    placeholder="PIN"
                                                    className="w-16 px-1 py-0.5 text-xs border border-primary/50 rounded focus:outline-none text-center bg-white"
                                                />
                                            )}
                                            {isPriceRevealed && selectedItem && (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-in fade-in">
                                                    Buy: {selectedItem.secondPurchasePrice || selectedItem.firstSalePrice || 0}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rs.</span>
                                        <input
                                            type="number"
                                            value={lineAmount}
                                            onChange={(e) => setLineAmount(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-all shadow-sm font-bold text-lg text-gray-800"
                                        />
                                    </div>
                                </div>

                                {/* Advance */}
                                <div className="w-full md:w-32">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Advance</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rs.</span>
                                        <input
                                            type="number"
                                            value={advanceAmount}
                                            onChange={(e) => setAdvanceAmount(e.target.value)}
                                            className="w-full pl-8 pr-3 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm font-bold text-gray-800"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Remaining */}
                                <div className="w-full md:w-32">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Remaining</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rs.</span>
                                        <input
                                            type="number"
                                            value={remainingAmount}
                                            readOnly
                                            className="w-full pl-8 pr-3 py-3 bg-gray-100 border border-transparent rounded-xl font-bold text-red-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="w-full md:w-auto md:shrink-0 flex items-end justify-end">
                                    {editingCartId ? (
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button type="button" onClick={handleAddOrUpdateItem} className="flex-1 md:flex-none bg-primary hover:bg-primary-dark text-slate-900 px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer">
                                                Update
                                            </button>
                                            <button type="button" onClick={() => {
                                                setEditingCartId(null);
                                                setSelectedItem(null);
                                                setSearchTerm("");
                                                setQuantity("1");
                                                setUnitPrice(0);
                                                setLineAmount("");
                                            }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-3 rounded-xl transition-all shadow-sm cursor-pointer">
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={handleAddOrUpdateItem} className="w-full md:w-auto px-3 bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center justify-center mb-1 gap-2 group whitespace-nowrap cursor-pointer">
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
                                            <tr key={item.tempId} className="hover:bg-primary/5 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-800">{item.item.name}</td>
                                                <td className="px-4 py-3 text-center text-gray-900 font-bold">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right text-gray-500">Rs. {item.unitPrice}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-800">Rs. {item.amount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-center space-x-2">
                                                    <button type="button" onClick={() => handleEditItem(item.tempId)} className="text-primary hover:text-primary-dark p-1 hover:bg-primary/10 rounded cursor-pointer">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteItem(item.tempId)} className="text-red-600 hover:text-red-800 p-1 hover:bg-red-100 rounded cursor-pointer">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t border-gray-100">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-600">Total:</td>
                                            <td className="px-4 py-3 text-right font-bold text-lg text-emerald-600">Rs. {displayTotal.toLocaleString()}</td>
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
                                className={`w-full md:w-auto px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider text-slate-900 shadow-lg shadow-primary/25 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/40 active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap border-2 border-transparent hover:border-primary/50 cursor-pointer ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary"} `}
                            >
                                {loading && <svg className="animate-spin h-5 w-5 text-slate-900" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                                <span>{isEdit ? 'Update' : 'Save'}</span>
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
                                    <th className="px-6 py-3">#</th>
                                    <th className="px-6 py-3">{type === 'credit' ? 'Customer' : 'Supplier'}</th>
                                    <th className="px-6 py-3">Date & Time</th>
                                    <th className="px-6 py-3">Item</th>
                                    <th className="px-6 py-3 text-center">Price</th>
                                    <th className="px-6 py-3 text-center">Qty</th>
                                    <th className="px-6 py-3 text-center">Amount</th>
                                    <th className="px-6 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentTransactions.map((bill, i) => {
                                    return (
                                        <tr key={bill.id || i} className="hover:bg-primary/5 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-gray-500">
                                                {bill.orderNumber || "---"}
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-gray-700">
                                                {bill.partyName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                <div>{new Date(bill.date).toLocaleDateString()}</div>
                                                <div className="text-xs text-gray-400">{new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-900 font-medium">
                                                {bill.items.length > 1 ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-primary font-bold">{bill.items.length} Items</span>
                                                        <span className="text-xs text-gray-500 truncate max-w-[200px]">
                                                            {bill.items.map((it: any) => it.itemName).join(", ")}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    bill.items[0]?.itemName || "N/A"
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-600 font-medium">
                                                {bill.items.length > 1 ? (
                                                    <span className="text-xs text-gray-400">---</span>
                                                ) : (
                                                    `Rs. ${bill.items[0]?.unitPrice || 0}`
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-600 font-bold">
                                                {bill.items.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0)}
                                            </td>
                                            <td className={`px-6 py-4 text-center font-bold text-lg ${bill.type === 'credit' ? 'text-emerald-600' : 'text-red-600'} `}>
                                                Rs. {Number(bill.total).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (bill.allIds) window.open(`/ledger/receipt/batch?ids=${bill.allIds}`, '_blank');
                                                            else if (bill.id) window.open(`/ledger/receipt/${bill.id}`, '_blank');
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-700 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                                        title="Print Bill"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>

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
            {stockErrorModal.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-red-100">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-50 mb-4 ring-8 ring-red-50/50">
                                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight">Stock Unavailable</h3>
                            <p className="text-gray-500 mb-8 font-medium leading-relaxed">{stockErrorModal.message}</p>
                            <div className="flex justify-center w-full">
                                <button
                                    type="button"
                                    onClick={() => setStockErrorModal({ open: false, message: "" })}
                                    className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-red-500/30 transform hover:-translate-y-0.5 cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
