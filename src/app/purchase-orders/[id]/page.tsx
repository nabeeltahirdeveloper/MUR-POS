"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Item {
    id: number;
    name: string;
    sku?: string;
}

interface POItem {
    itemId: number;
    qty: number;
    pricePerUnit: number;
    item?: Item; // For display
}

interface PurchaseOrder {
    id: number;
    supplier: { id: number; name: string };
    status: string;
    totalAmount: number;
    notes: string;
    terms: string;
    createdAt: string;
    items: POItem[];
}

export default function PurchaseOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<POItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Item Search State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Item[]>([]);
    const [showResults, setShowResults] = useState(false);

    // New Item Input State
    const [newItemQty, setNewItemQty] = useState(1);
    const [newItemPrice, setNewItemPrice] = useState(0);

    useEffect(() => {
        fetchPO();
    }, [id]);

    const fetchPO = async () => {
        try {
            const res = await fetch(`/api/purchase-orders/${id}`);
            if (!res.ok) throw new Error("Failed to load PO");
            const data = await res.json();
            setPo(data);
            // Map API items to state items
            setItems(data.items.map((i: any) => ({
                itemId: i.itemId,
                qty: parseFloat(i.qty),
                pricePerUnit: parseFloat(i.pricePerUnit),
                item: i.item
            })));
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    // Item Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }
            try {
                const res = await fetch(`/api/items?search=${encodeURIComponent(searchTerm)}`);
                const data = await res.json();
                // data might be { items: [...] } or just array depending on API
                setSearchResults(data.items || []);
                setShowResults(true);
            } catch (e) {
                console.error(e);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleAddItem = (item: Item) => {
        setItems([...items, { itemId: item.id, qty: newItemQty, pricePerUnit: newItemPrice, item }]);
        setSearchTerm("");
        setShowResults(false);
        setNewItemQty(1);
        setNewItemPrice(0);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleSaveItems = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/purchase-orders/${id}/items`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });
            if (!res.ok) throw new Error("Failed to save items");
            await fetchPO(); // Reload to get fresh totals
            alert("Items saved successfully");
        } catch (err) {
            console.error(err);
            alert("Failed to save items");
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/purchase-orders/${id}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            await fetchPO();
        } catch (err) {
            console.error(err);
            alert("Failed to update status");
        } finally {
            setSaving(false);
        }
    };

    const handleReceive = async () => {
        if (!confirm("This will add items to stock. This cannot be undone. Proceed?")) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/purchase-orders/${id}/receive`, {
                method: "POST",
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to receive.");
            }
            await fetchPO();
            alert("Purchase Order Received! Stock updated.");
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel this PO?")) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/purchase-orders/${id}/cancel`, { method: "POST" });
            if (!res.ok) throw new Error("Failed");
            await fetchPO();
        } catch (err) {
            console.error(err);
            alert("Failed to cancel");
        } finally {
            setSaving(false);
        }
    }

    if (loading || !po) return <div className="p-6">Loading...</div>;

    const isEditable = po.status === "draft" || po.status === "pending";
    // Assuming 'pending' can still edit items? Requirements say "Draft: edit items...".
    // Let's restrict editing items to Draft only for safety, or allow Pending?
    // User req: "Draft: edit items... Pending: approve or cancel". So Pending cannot edit items.
    const canEditItems = po.status === "draft";

    const totalAmount = items.reduce((sum, i) => sum + (i.qty * i.pricePerUnit), 0);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Link href="/purchase-orders" className="text-gray-500 hover:text-gray-700">&larr; Back</Link>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">PO #{po.id}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">{po.supplier.name}</h1>
                    <div className="mt-2 flex gap-2">
                        <span className={`px-2 py-1 rounded text-sm font-semibold uppercase ${po.status === 'received' ? 'bg-green-100 text-green-800' :
                                po.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    po.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                        'bg-yellow-100 text-yellow-800'
                            }`}>
                            {po.status}
                        </span>
                        <span className="text-gray-500 text-sm py-1">
                            Created: {new Date(po.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link href={`/purchase-orders/${id}/print`} target="_blank" className="px-4 py-2 border rounded hover:bg-gray-50">
                        Print
                    </Link>

                    {po.status === 'draft' && (
                        <button onClick={() => handleStatusChange('pending')} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Submit for Approval
                        </button>
                    )}
                    {po.status === 'pending' && (
                        <button onClick={() => handleStatusChange('approved')} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            Approve
                        </button>
                    )}
                    {po.status === 'approved' && (
                        <button onClick={handleReceive} disabled={saving} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                            Receive Goods
                        </button>
                    )}
                    {(po.status !== 'received' && po.status !== 'cancelled') && (
                        <button onClick={handleCancel} disabled={saving} className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200">
                            Cancel PO
                        </button>
                    )}
                </div>
            </div>

            {/* Items Section */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Items</h2>
                    {canEditItems && (
                        <button
                            onClick={handleSaveItems}
                            disabled={saving}
                            className="text-sm px-3 py-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                        >
                            {saving ? "Saving..." : "Save Items"}
                        </button>
                    )}
                </div>

                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                            {canEditItems && <th className="px-4 py-3 text-right"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="px-4 py-3 text-sm text-gray-900">{item.item?.name || "Unknown Item"}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.qty}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">${item.pricePerUnit.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">${(item.qty * item.pricePerUnit).toFixed(2)}</td>
                                {canEditItems && (
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">
                                            &times;
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}

                        {/* Add Item Row */}
                        {canEditItems && (
                            <tr className="bg-blue-50">
                                <td className="px-4 py-3 relative">
                                    <input
                                        type="text"
                                        className="w-full border rounded px-2 py-1"
                                        placeholder="Search items..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    {showResults && searchResults.length > 0 && (
                                        <div className="absolute z-10 left-0 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto ml-4">
                                            {searchResults.map(res => (
                                                <div
                                                    key={res.id}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                    onClick={() => handleAddItem(res)}
                                                >
                                                    {res.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-20 border rounded px-2 py-1 text-right"
                                        value={newItemQty}
                                        onChange={e => setNewItemQty(parseFloat(e.target.value))}
                                    />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-24 border rounded px-2 py-1 text-right"
                                        value={newItemPrice}
                                        onChange={e => setNewItemPrice(parseFloat(e.target.value))}
                                    />
                                </td>
                                <td className="px-4 py-3"></td>
                                <td className="px-4 py-3"></td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-gray-900">Total Amount:</td>
                            <td className="px-4 py-3 text-right text-gray-900">${totalAmount.toFixed(2)}</td>
                            {canEditItems && <td></td>}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Notes & Terms */}
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow border">
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-gray-600 whitespace-pre-wrap">{po.notes || "None"}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border">
                    <h3 className="font-semibold mb-2">Terms</h3>
                    <p className="text-gray-600 whitespace-pre-wrap">{po.terms || "None"}</p>
                </div>
            </div>
        </div>
    );
}
