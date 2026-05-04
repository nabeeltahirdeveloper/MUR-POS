"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAlert } from "@/contexts/AlertContext";

interface Item {
    id: string;
    name: string;
    sku?: string;
    category?: { id: string; name: string } | null;
}

interface POItem {
    itemId: string;
    qty: number;
    pricePerUnit: number;
    item?: Item; // For display
}

interface Supplier {
    id: string;
    name: string;
}

interface PurchaseOrder {
    id: string;
    supplier: { id: string; name: string } | null;
    status: "draft" | "pending" | "approved" | "received" | "cancelled";
    totalAmount: number;
    notes: string;
    terms: string;
    createdAt: string;
    items: POItem[];
}

export default function PurchaseOrderDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { showConfirm, showAlert } = useAlert();

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<POItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Item Search State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Item[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // New Item Input State
    const [newItemQty, setNewItemQty] = useState(1);
    const [newItemPrice, setNewItemPrice] = useState(0);

    // Header editing
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [showEditDetails, setShowEditDetails] = useState(false);
    const [detailsForm, setDetailsForm] = useState({ supplierId: "", notes: "", terms: "" });

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
            setDetailsForm({
                supplierId: data.supplier?.id || "",
                notes: data.notes || "",
                terms: data.terms || "",
            });
            setError(null);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError("Failed to load purchase order");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetch("/api/suppliers?limit=500")
            .then((res) => res.json())
            .then((data) => setSuppliers(data.suppliers || []))
            .catch(() => setSuppliers([]));
    }, []);

    // Item Search
    useEffect(() => {
        const q = searchTerm.trim();
        const delayDebounceFn = setTimeout(async () => {
            if (q.length < 1) {
                setSearchResults([]);
                setShowResults(false);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const res = await fetch(`/api/items?search=${encodeURIComponent(q)}`);
                const data = await res.json();
                const results = Array.isArray(data) ? data : (data.items || []);
                setSearchResults(results);
                setShowResults(true);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 250);

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

    const updateRow = (index: number, patch: Partial<Pick<POItem, "qty" | "pricePerUnit">>) => {
        setItems((prev) => {
            const next = [...prev];
            const row = next[index];
            if (!row) return prev;
            next[index] = { ...row, ...patch };
            return next;
        });
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
            await showAlert("Items saved successfully", { variant: "success", title: "Success" });
        } catch (err) {
            console.error(err);
            await showAlert("Failed to save items", { variant: "danger", title: "Error" });
        } finally {
            setSaving(false);
        }
    };

    const canEditDetails = po && po.status !== "received" && po.status !== "cancelled";

    const handleSaveDetails = async () => {
        if (!po) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/purchase-orders/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    supplierId: detailsForm.supplierId || null,
                    notes: detailsForm.notes,
                    terms: detailsForm.terms,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to update purchase order");
            await fetchPO();
            setShowEditDetails(false);
        } catch (e: any) {
            setError(e.message || "Failed to update purchase order");
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!await showConfirm(`Are you sure you want to change status to ${newStatus}?`)) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/purchase-orders/${id}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to update status");
            }
            await fetchPO();
        } catch (err) {
            console.error(err);
            await showAlert((err as any).message || "Failed to update status", { variant: "danger" });
        } finally {
            setSaving(false);
        }
    };

    const handleReceive = async () => {
        if (!await showConfirm("This will add items to stock. This cannot be undone. Proceed?")) return;

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
            await showAlert("Purchase Order Received! Stock updated.", { variant: "success" });
        } catch (err: any) {
            console.error(err);
            await showAlert(err.message, { variant: "danger" });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        if (!await showConfirm("Are you sure you want to cancel this PO?", { variant: "danger" })) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/purchase-orders/${id}/cancel`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to cancel");
            }
            await fetchPO();
        } catch (err) {
            console.error(err);
            await showAlert((err as any).message || "Failed to cancel", { variant: "danger" });
        } finally {
            setSaving(false);
        }
    }

    if (loading || !po) return <div className="p-6 flex justify-center"><LoadingSpinner /></div>;

    const canEditItems = po.status === "draft";

    // IMPORTANT: guard against undefined/NaN so footer doesn't fall back to 0
    // (NaN is falsy and `formatPKR` uses `amount || 0`).
    const totalAmount = items.reduce(
        (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.pricePerUnit) || 0),
        0
    );
    const supplierName = po.supplier?.name || "No Supplier";
    const supplierIdCurrent = po.supplier?.id || "";
    const hasItems = items.length > 0;

    const formatPKR = (amount: number) =>
        new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 2,
        }).format(Number(amount || 0));

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Link href="/purchase-orders" className="text-gray-600 hover:text-gray-900 font-medium">&larr; Back</Link>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-600 font-medium">PO #{po.id}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">{supplierName}</h1>
                    <div className="mt-2 flex gap-2">
                        <span className={`px-2 py-1 rounded text-sm font-semibold uppercase ${po.status === 'received' ? 'bg-green-50 text-green-700 border border-green-200' :
                            po.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                po.status === 'approved' ? 'bg-primary/10 text-primary border border-primary/40' :
                                    'bg-gray-100 text-gray-700'
                            }`}>
                            {po.status}
                        </span>
                        <span className="text-gray-600 text-sm py-1 font-medium">
                            Created: {new Date(po.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link href={`/purchase-orders/${id}/print`} target="_blank" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded shadow-sm hover:bg-gray-50 transition-colors">
                        Print
                    </Link>

                    {po.status === 'draft' && (
                        <button
                            onClick={() => handleStatusChange('pending')}
                            disabled={saving || !hasItems}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                            title={!hasItems ? "Add at least one item before submitting" : undefined}
                        >
                            Submit for Approval
                        </button>
                    )}
                    {po.status === 'pending' && (
                        <button
                            onClick={() => handleStatusChange('approved')}
                            disabled={saving || !hasItems}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                            title={!hasItems ? "Add at least one item before approving" : undefined}
                        >
                            Approve
                        </button>
                    )}
                    {po.status === 'approved' && (
                        <button onClick={handleReceive} disabled={saving} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark cursor-pointer">
                            Receive Goods
                        </button>
                    )}
                    {(po.status !== 'received' && po.status !== 'cancelled') && (
                        <button onClick={handleCancel} disabled={saving} className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 cursor-pointer">
                            Cancel PO
                        </button>
                    )}
                </div>
            </div>

            {error && <ErrorDisplay message={error} />}

            {/* PO Details */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Details</h2>
                    {canEditDetails && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEditDetails((v) => !v)}
                            disabled={saving}
                        >
                            {showEditDetails ? "Close" : "Edit Details"}
                        </Button>
                    )}
                </div>

                {showEditDetails ? (
                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                                <select
                                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                                    value={detailsForm.supplierId}
                                    onChange={(e) => setDetailsForm((f) => ({ ...f, supplierId: e.target.value }))}
                                >
                                    <option value="">No supplier</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                {supplierIdCurrent && !suppliers.some((s) => s.id === supplierIdCurrent) && (
                                    <p className="text-xs text-primary mt-1">Current supplier not in dropdown (may be deleted).</p>
                                )}
                            </div>
                            <div className="flex items-end justify-end">
                                <Button onClick={handleSaveDetails} isLoading={saving}>
                                    Save Details
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-gray-900"
                                    value={detailsForm.notes}
                                    onChange={(e) => setDetailsForm((f) => ({ ...f, notes: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-gray-900"
                                    value={detailsForm.terms}
                                    onChange={(e) => setDetailsForm((f) => ({ ...f, terms: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold">Notes</div>
                            <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{po.notes || "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold">Terms</div>
                            <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{po.terms || "—"}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Items Section */}
            {/* Must be overflow-visible so the search dropdown isn't clipped */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-visible">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Items</h2>
                    {canEditItems && (
                        <button
                            onClick={handleSaveItems}
                            disabled={saving}
                            className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium cursor-pointer"
                        >
                            {saving ? "Saving..." : "Save Items"}
                        </button>
                    )}
                </div>

                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Qty</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Price</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                            {canEditItems && <th className="px-4 py-3 text-right"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    <div className="font-medium">{item.item?.name || "Unknown Item"}</div>
                                    {item.item?.category?.name ? (
                                        <div className="text-xs text-gray-500">{item.item.category.name}</div>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                    {canEditItems ? (
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-24 border rounded px-2 py-1 text-right text-gray-900"
                                            value={Number.isFinite(item.qty) ? item.qty : 0}
                                            onChange={(e) => updateRow(idx, { qty: parseFloat(e.target.value) || 0 })}
                                        />
                                    ) : (
                                        item.qty
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">
                                    {canEditItems ? (
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-28 border rounded px-2 py-1 text-right text-gray-900"
                                            value={Number.isFinite(item.pricePerUnit) ? item.pricePerUnit : 0}
                                            onChange={(e) => updateRow(idx, { pricePerUnit: parseFloat(e.target.value) || 0 })}
                                        />
                                    ) : (
                                        formatPKR(item.pricePerUnit)
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">
                                    {formatPKR((Number(item.qty) || 0) * (Number(item.pricePerUnit) || 0))}
                                </td>
                                {canEditItems && (
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 cursor-pointer">
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
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full border rounded px-2 py-1 pr-8 text-gray-900"
                                            placeholder="Search items..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                        {isSearching && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    {showResults && searchResults.length > 0 && (
                                        <div className="absolute z-20 left-4 mt-1 w-96 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                                            {searchResults.map(res => (
                                                <div
                                                    key={res.id}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                                    onClick={() => handleAddItem(res)}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate font-medium text-gray-900">{res.name}</span>
                                                        {res.category?.name ? (
                                                            <span className="text-xs text-gray-500 truncate">{res.category.name}</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {showResults && searchResults.length === 0 && (
                                        <div className="absolute z-20 left-4 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg p-2 text-sm text-gray-700">
                                            No items found
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-20 border rounded px-2 py-1 text-right text-gray-900"
                                        value={newItemQty}
                                        onChange={e => setNewItemQty(parseFloat(e.target.value) || 0)}
                                    />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-24 border rounded px-2 py-1 text-right text-gray-900"
                                        value={newItemPrice}
                                        onChange={e => setNewItemPrice(parseFloat(e.target.value) || 0)}
                                    />
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-900 whitespace-nowrap">
                                    {formatPKR((Number(newItemQty) || 0) * (Number(newItemPrice) || 0))}
                                </td>
                                <td className="px-4 py-3"></td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-gray-900">Total Amount:</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatPKR(totalAmount)}</td>
                            {canEditItems && <td></td>}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
