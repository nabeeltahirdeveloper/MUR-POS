"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAlert } from "@/contexts/AlertContext";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PrinterIcon, PencilSquareIcon, LockClosedIcon, LockOpenIcon, MinusIcon } from "@heroicons/react/24/outline";
import { RemoveTransactionItemModal } from "./RemoveTransactionItemModal";

interface LedgerEntry {
    id: string;
    date: string;
    amount: number;
    type: 'debit' | 'credit';
    status?: 'open' | 'closed';
    note?: string;
    orderNumber?: number;
    // ... other fields
}

export function SupplierLedgerList({ supplierName }: { supplierName: string }) {
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { showAlert, showConfirm } = useAlert();
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [selectedItemForRemoval, setSelectedItemForRemoval] = useState<{
        ledgerId: string;
        item: { name: string; qty: string; rate: string };
    } | null>(null);
    const [removingItem, setRemovingItem] = useState(false);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            // Search by "Supplier: Name" to find relevant entries
            const res = await fetch(`/api/ledger?search=Supplier: ${encodeURIComponent(supplierName)}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch supplier ledger", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (supplierName) {
            fetchEntries();
        }
    }, [supplierName]);

    const toggleStatus = async (entry: LedgerEntry) => {
        const newStatus = entry.status === 'closed' ? 'open' : 'closed';
        const action = newStatus === 'open' ? 'Re-open' : 'Close';

        if (!await showConfirm(`${action} this transaction?`)) return;

        try {
            const res = await fetch(`/api/ledger/${entry.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: newStatus } : e));
                showAlert(`Transaction ${newStatus} successfully`, { variant: "success" });
            } else {
                const d = await res.json();
                showAlert(d.error || "Failed to update status", { variant: "danger" });
            }
        } catch (error) {
            console.error("Failed to toggle status", error);
            showAlert("Error updating status", { variant: "danger" });
        }
    };

    const handleRemoveItem = async (quantityToRemove: number, reason: string, notes: string) => {
        if (!selectedItemForRemoval) return;

        setRemovingItem(true);
        try {
            const res = await fetch("/api/ledger/remove-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ledgerId: selectedItemForRemoval.ledgerId,
                    quantityToRemove,
                    reason,
                    notes,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to remove item");
            }

            const result = await res.json();
            showAlert(`${quantityToRemove} item(s) removed successfully`, { variant: "success" });
            setShowRemoveModal(false);
            setSelectedItemForRemoval(null);
            fetchEntries(); // Refresh
        } catch (error: any) {
            console.error("Failed to remove item:", error);
            showAlert(error.message || "Failed to remove item from transaction", { variant: "danger" });
        } finally {
            setRemovingItem(false);
        }
    };

    const parseLedgerNote = (note: string | undefined): { cleanedNote: string; advance: string; remaining: string; paymentMethod: string | null; itemDetails: { name: string; qty: string; rate: string; raw: string } | null } => {
        if (!note) return { cleanedNote: '-', advance: '-', remaining: '-', paymentMethod: null, itemDetails: null };

        const lines = note.split('\n');
        let advance = '-';
        let remaining = '-';
        let paymentMethod: string | null = null;
        let itemDetails: { name: string; qty: string; rate: string; raw: string } | null = null;
        const cleanLines: string[] = [];

        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.startsWith("advance: ")) {
                advance = line.substring("advance: ".length).trim();
            } else if (lowerLine.startsWith("remaining: ")) {
                remaining = line.substring("remaining: ".length).trim();
            } else if (lowerLine.startsWith("payment: ")) {
                paymentMethod = line.substring("payment: ".length).trim();
            } else if (lowerLine.startsWith("supplier: ") ||
                lowerLine.startsWith("phone: ") ||
                lowerLine.startsWith("address: ")) {
                // Skip
            } else if (lowerLine.startsWith("item: ")) {
                // Try to parse item string: "Item: [Stock] name (Qty: 10 pc @500)"
                const raw = line.substring("item: ".length).trim();
                const match = raw.match(/^(?:\[.*?\]\s*)?(.*?)\s*\(Qty:\s*(.*?)\s*@\s*(.*?)\)$/i);
                if (match) {
                    itemDetails = {
                        name: match[1].trim(),
                        qty: match[2].trim(),
                        rate: match[3].trim(),
                        raw: raw
                    };
                } else {
                    // Fallback if format doesn't match exactly
                    itemDetails = { name: raw, qty: '-', rate: '-', raw: raw };
                }
            } else {
                cleanLines.push(line);
            }
        });

        return {
            cleanedNote: cleanLines.join('\n').trim(),
            advance: advance !== '-' ? Number(advance).toLocaleString() : '-',
            remaining: remaining !== '-' ? Number(remaining).toLocaleString() : '-',
            paymentMethod,
            itemDetails
        };
    };

    const groupedEntries = entries.reduce((acc, entry) => {
        const { cleanedNote, advance, remaining, paymentMethod, itemDetails } = parseLedgerNote(entry.note);

        // Key for grouping: Order Number matches, OR falling back to date + type if no order #
        // But strictly, we should group by Order ID if available.
        // If entry.orderNumber is present, use it.
        // If not, use entry.id (no grouping for legacy/manual entries without order #)
        const key = entry.orderNumber
            ? `ORD-${entry.orderNumber}`
            : `ID-${entry.id}`;

        if (!acc[key]) {
            acc[key] = {
                id: entry.id, // Use first ID as group ID (for edit link)
                date: entry.date,
                orderNumber: entry.orderNumber,
                type: entry.type,
                status: entry.status,
                totalAmount: 0,
                advance: advance, // Display from first entry (usually same for batch)
                remaining: remaining, // Display from first entry
                items: [],
                notes: [],
                rawEntries: []
            };
        }

        // Aggregate
        acc[key].totalAmount += entry.amount;
        if (itemDetails) {
            acc[key].items.push(itemDetails);
        }
        if (cleanedNote && !itemDetails) {
            acc[key].notes.push(cleanedNote);
        }
        acc[key].rawEntries.push(entry);

        return acc;
    }, {} as Record<string, {
        id: string;
        date: string;
        orderNumber?: number;
        type: 'debit' | 'credit';
        status?: 'open' | 'closed';
        totalAmount: number;
        advance: string;
        remaining: string;
        items: { name: string; qty: string; rate: string; raw: string }[];
        notes: string[];
        rawEntries: LedgerEntry[];
    }>);

    const sortedGroups = Object.values(groupedEntries).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (loading) return <div className="p-4 flex justify-center"><LoadingSpinner /></div>;
    if (entries.length === 0) return <div className="p-4 text-gray-500 italic">No transactions found for this supplier.</div>;

    return (
        <div className="p-4">
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Item</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Advance</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedGroups.map(group => (
                            <tr key={group.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap align-top font-mono">
                                    {group.orderNumber ? group.orderNumber : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap align-top">
                                    {new Date(group.date).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 align-top">
                                    {group.items.length > 0 ? (
                                        <details className="group">
                                            <summary className="cursor-pointer list-none font-medium text-gray-800 flex items-center gap-1">
                                                <span className="truncate max-w-[150px]">
                                                    {group.items.length} Items
                                                    {group.items.length === 1 && ` (${group.items[0].name})`}
                                                </span>
                                                <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                                            </summary>
                                            <div className="mt-1 pl-2 text-xs text-gray-600 border-l-2 border-gray-200 space-y-1">
                                                {group.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between gap-4 items-center group/item py-1">
                                                        <div className="flex-1">
                                                            <span className="font-medium text-gray-700">{item.name}</span>
                                                            <div className="flex gap-2 whitespace-nowrap">
                                                                <span className="text-gray-500">@{item.rate}</span>
                                                                <span className="text-gray-400 font-semibold">x{item.qty}</span>
                                                            </div>
                                                        </div>
                                                        {group.status !== 'closed' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setSelectedItemForRemoval({
                                                                        ledgerId: group.id,
                                                                        item: item
                                                                    });
                                                                    setShowRemoveModal(true);
                                                                }}
                                                                className="opacity-0 group-hover/item:opacity-100 text-red-500 hover:text-red-700 transition-all p-1 rounded hover:bg-red-50"
                                                                title="Remove from transaction"
                                                            >
                                                                <MinusIcon className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {group.notes.length > 0 && (
                                                    <div className="pt-1 border-t border-gray-100 italic text-gray-500">
                                                        {group.notes.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </details>
                                    ) : (
                                        <div className="text-sm text-gray-600 whitespace-pre-wrap">
                                            {group.notes.length > 0 ? group.notes.join(', ') : '-'}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap capitalize align-top">
                                    <span className={`px-2 py-0.5 rounded text-xs ${group.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {group.type}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap font-medium align-top">
                                    <div>{group.totalAmount.toLocaleString()}</div>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap align-top">
                                    {group.advance}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap align-top">
                                    {group.remaining}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap align-top">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${group.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-primary/15 text-primary-dark'}`}>
                                        {group.status === 'closed' ? 'Closed' : 'Open'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-sm whitespace-nowrap space-x-2 align-top">
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/ledger/receipt/batch?ids=${group.rawEntries.map(e => e.id).join(',')}`}
                                            className="text-gray-500 hover:text-gray-900 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                            target="_blank"
                                            title="Print Receipt"
                                        >
                                            <PrinterIcon className="h-5 w-5" />
                                        </Link>

                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                // Batch toggle?
                                                const newStatus = group.status === 'closed' ? 'open' : 'closed';
                                                if (await showConfirm(`${newStatus === 'open' ? 'Re-open' : 'Close'} this entire order?`)) {
                                                    for (const entry of group.rawEntries) {
                                                        await fetch(`/api/ledger/${entry.id}`, {
                                                            method: 'PUT',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ status: newStatus })
                                                        });
                                                    }
                                                    fetchEntries(); // Refresh all
                                                }
                                            }}
                                            className={`transition-colors ${group.status === 'closed' ? 'text-primary hover:text-primary' : 'text-gray-500 hover:text-red-600'}`}
                                            title={group.status === 'closed' ? 'Re-open Order' : 'Close Order'}
                                        >
                                            {group.status === 'closed' ? (
                                                <LockOpenIcon className="h-5 w-5" />
                                            ) : (
                                                <LockClosedIcon className="h-5 w-5" />
                                            )}
                                        </button>

                                        {group.status !== 'closed' && (
                                            <Link
                                                href={`/ledger/${group.id}/edit`} // Edit first ID, form handles batch fetch
                                                className="text-primary hover:text-primary transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Edit Transaction"
                                            >
                                                <PencilSquareIcon className="h-5 w-5" />
                                            </Link>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Remove Item Modal */}
            <RemoveTransactionItemModal
                isOpen={showRemoveModal}
                item={selectedItemForRemoval?.item || null}
                isLoading={removingItem}
                onConfirm={handleRemoveItem}
                onCancel={() => {
                    setShowRemoveModal(false);
                    setSelectedItemForRemoval(null);
                }}
            />
        </div>
    );
}
