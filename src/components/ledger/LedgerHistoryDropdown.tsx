"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, PrinterIcon, LockClosedIcon, LockOpenIcon, MinusIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useAlert } from "@/contexts/AlertContext";
import { RemoveTransactionItemModal } from "./RemoveTransactionItemModal";

interface LedgerEntry {
    id: string;
    date: string;
    amount: number;
    type: 'debit' | 'credit';
    status?: 'open' | 'closed';
    note?: string;
    orderNumber?: number;
}

interface LedgerHistoryDropdownProps {
    type: 'supplier' | 'customer';
    name: string;
}

interface DateGroup {
    date: string;
    entries: LedgerEntry[];
    itemCount: number;
    total: number;
    orderNumber?: number;
    transactionCount?: number;
}

export function LedgerHistoryDropdown({ type, name }: LedgerHistoryDropdownProps) {
    const { showConfirm, showAlert } = useAlert();
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewLevel, setViewLevel] = useState<'years' | 'months' | 'dates'>('years');
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [selectedItemForRemoval, setSelectedItemForRemoval] = useState<{
        ledgerId: string;
        item: { name: string; qty: string; rate: string };
        purchasePrice?: number;
    } | null>(null);
    const [removingItem, setRemovingItem] = useState(false);

    useEffect(() => {
        fetchEntries();
    }, [name, type]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const prefix = type === 'supplier' ? 'Supplier:' : 'Customer:';
            const res = await fetch(`/api/ledger?search=${prefix} ${encodeURIComponent(name)}&limit=1000`);
            if (res.ok) {
                const data = await res.json();
                // Filter for inventory items only (entries containing "Item:")
                const itemEntries = (data.data || []).filter((e: any) =>
                    (e.note || "").toLowerCase().includes("item:")
                );
                setEntries(itemEntries);
            }
        } catch (error) {
            console.error(`Failed to fetch ${type} entries:`, error);
        } finally {
            setLoading(false);
        }
    };

    const getAvailableYears = (entries: LedgerEntry[]): number[] => {
        const years = new Set<number>();
        entries.forEach(entry => {
            const year = new Date(entry.date).getFullYear();
            years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    };

    const filterEntriesByYearMonth = (entries: LedgerEntry[], year: number, month: number | null): LedgerEntry[] => {
        return entries.filter(entry => {
            const entryDate = new Date(entry.date);
            const entryYear = entryDate.getFullYear();
            const entryMonth = entryDate.getMonth() + 1; // 1-12

            if (month === null) {
                return entryYear === year;
            }
            return entryYear === year && entryMonth === month;
        });
    };

    const groupByDate = (entries: LedgerEntry[]): DateGroup[] => {
        const dateGroups: Record<string, LedgerEntry[]> = {};

        entries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString();
            if (!dateGroups[date]) {
                dateGroups[date] = [];
            }
            dateGroups[date].push(entry);
        });

        return Object.entries(dateGroups).map(([date, groupEntries]) => ({
            date,
            entries: groupEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            itemCount: groupEntries.length,
            total: groupEntries.reduce((sum, e) => sum + e.amount, 0),
            transactionCount: groupEntries.length
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const calculateTotal = (entries: LedgerEntry[]): number => {
        return entries.reduce((sum, entry) => sum + entry.amount, 0);
    };

    const parseLedgerNote = (note: string | undefined): {
        itemName: string;
        qty: string;
        paymentMethod: string | null;
        advance: string;
        remaining: string;
        orderNumber: string;
    } => {
        if (!note) return { itemName: '-', qty: '-', paymentMethod: null, advance: '-', remaining: '-', orderNumber: '-' };

        const lines = note.split('\n');
        let paymentMethod: string | null = null;
        let itemName = '-';
        let qty = '-';
        let advance = '-';
        let remaining = '-';
        let orderNumber = '-';

        lines.forEach(line => {
            const trimmed = line.trim();
            const lowerLine = trimmed.toLowerCase();

            if (trimmed.startsWith("Order #")) {
                orderNumber = trimmed.replace("Order #", "").trim();
            } else if (lowerLine.startsWith("payment: ")) {
                paymentMethod = trimmed.substring("payment: ".length).trim();
            } else if (lowerLine.startsWith("advance: ")) {
                advance = trimmed.substring("advance: ".length).trim();
            } else if (lowerLine.startsWith("remaining: ")) {
                remaining = trimmed.substring("remaining: ".length).trim();
            } else if (lowerLine.startsWith("item: ")) {
                const raw = trimmed.substring("item: ".length).trim();
                const match = raw.match(/^(?:\[.*?\]\s*)?(.*?)\s*\(Qty:\s*(.*?)\s*@\s*(.*?)\)$/i);
                if (match) {
                    itemName = match[1].trim();
                    qty = match[2].trim();
                } else {
                    itemName = raw;
                }
            }
        });

        return {
            itemName,
            qty,
            paymentMethod,
            advance: advance !== '-' ? Number(advance).toLocaleString() : '-',
            remaining: remaining !== '-' ? Number(remaining).toLocaleString() : '-',
            orderNumber
        };
    };

    const toggleDate = (date: string) => {
        setExpandedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(date)) {
                newSet.delete(date);
            } else {
                newSet.add(date);
            }
            return newSet;
        });
    };

    const formatTime = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatItemNames = (note: string | undefined): string => {
        if (!note) return '-';

        const lines = note.split('\n');
        const itemNames: string[] = [];

        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.startsWith("item: ")) {
                const raw = line.substring("item: ".length).trim();
                // Extract item name from format: "[Stock] name (Qty: X @Y)"
                const match = raw.match(/^(?:\[.*?\]\s*)?(.*?)\s*\(Qty:/i);
                if (match) {
                    itemNames.push(match[1].trim());
                }
            }
        });

        if (itemNames.length === 0) return '-';
        if (itemNames.length === 1) return itemNames[0];

        // For multiple items, show first 2 and count
        if (itemNames.length <= 3) {
            return itemNames.join(', ');
        }

        return `${itemNames.slice(0, 2).join(', ')}, ...${itemNames.length}+`;
    };

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
                // Refresh entries to reflect the status change
                fetchEntries();
            }
        } catch (error) {
            console.error("Failed to toggle status", error);
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
            showAlert(`${quantityToRemove} item(s) removed successfully. New quantity: ${result.newQuantity}`, { variant: "success" });
            setShowRemoveModal(false);
            setSelectedItemForRemoval(null);
            
            // Add a small delay to ensure database is updated, then refresh
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Reset view levels to force complete refresh and show all data updated
            setViewLevel('years');
            setSelectedYear(null);
            setSelectedMonth(null);
            setExpandedDates(new Set());
            
            fetchEntries(); // Refresh all entries and recalculate totals
        } catch (error: any) {
            console.error("Failed to remove item:", error);
            showAlert(error.message || "Failed to remove item from transaction", { variant: "danger" });
        } finally {
            setRemovingItem(false);
        }
    };

    const months = [
        { value: null, label: "All Months" },
        { value: 1, label: "January" },
        { value: 2, label: "February" },
        { value: 3, label: "March" },
        { value: 4, label: "April" },
        { value: 5, label: "May" },
        { value: 6, label: "June" },
        { value: 7, label: "July" },
        { value: 8, label: "August" },
        { value: 9, label: "September" },
        { value: 10, label: "October" },
        { value: 11, label: "November" },
        { value: 12, label: "December" },
    ];

    if (loading) {
        return (
            <div className="p-4 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="p-4 text-gray-500 italic text-sm">
                No transactions found for this {type}.
            </div>
        );
    }

    // Calculate year data
    const yearData = getAvailableYears(entries).map(year => ({
        year,
        total: calculateTotal(filterEntriesByYearMonth(entries, year, null))
    }));

    // Calculate month data for selected year
    const monthData = selectedYear ? months.slice(1).map(m => {
        const monthEntries = filterEntriesByYearMonth(entries, selectedYear, m.value);
        return {
            month: m.value!,
            label: m.label,
            total: calculateTotal(monthEntries),
            hasData: monthEntries.length > 0
        };
    }).filter(m => m.hasData) : [];

    // Calculate date groups for selected month
    const filteredEntries = selectedYear && selectedMonth
        ? filterEntriesByYearMonth(entries, selectedYear, selectedMonth)
        : [];
    const dateGroups = groupByDate(filteredEntries);

    const formatCurrency = (val: number) => {
        return `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <>
            <div className="p-4 bg-gray-50 space-y-4">
            {/* Breadcrumb Navigation */}
            {viewLevel !== 'years' && (
                <div className="flex items-center gap-2 text-sm">
                    <button
                        onClick={() => {
                            setViewLevel('years');
                            setSelectedYear(null);
                            setSelectedMonth(null);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        Years
                    </button>
                    {selectedYear && (
                        <>
                            <span className="text-gray-400">›</span>
                            {viewLevel === 'dates' ? (
                                <button
                                    onClick={() => {
                                        setViewLevel('months');
                                        setSelectedMonth(null);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                    {selectedYear}
                                </button>
                            ) : (
                                <span className="text-gray-700 font-medium">{selectedYear}</span>
                            )}
                        </>
                    )}
                    {selectedMonth && (
                        <>
                            <span className="text-gray-400">›</span>
                            <span className="text-gray-700 font-medium">
                                {months.find(m => m.value === selectedMonth)?.label}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Years View */}
            {viewLevel === 'years' && (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {yearData.map(({ year, total }) => (
                        <div
                            key={year}
                            onClick={() => {
                                setSelectedYear(year);
                                setViewLevel('months');
                            }}
                            className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                            <span className="text-lg font-semibold text-gray-900">{year}</span>
                            <span className="text-lg font-bold text-blue-600">{formatCurrency(total)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Months View */}
            {viewLevel === 'months' && selectedYear && (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {monthData.map(({ month, label, total }) => (
                        <div
                            key={month}
                            onClick={() => {
                                setSelectedMonth(month);
                                setViewLevel('dates');
                            }}
                            className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                            <span className="text-lg font-semibold text-gray-900">{label}</span>
                            <span className="text-lg font-bold text-blue-600">{formatCurrency(total)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Dates View */}
            {viewLevel === 'dates' && selectedYear && selectedMonth && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {dateGroups.map((group) => {
                        const isExpanded = expandedDates.has(group.date);
                        return (
                            <div key={group.date} className="border-b last:border-b-0 border-gray-100">
                                {/* Date Header Row */}
                                <div
                                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                    onClick={() => toggleDate(group.date)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {isExpanded ? (
                                                <ChevronDownIcon className="h-4 w-4" />
                                            ) : (
                                                <ChevronRightIcon className="h-4 w-4" />
                                            )}
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-900 block">{group.date}</span>
                                            <span className="text-xs text-gray-500 font-medium">
                                                {group.entries.length} {group.entries.length === 1 ? 'transaction' : 'transactions'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-gray-900">{formatCurrency(group.total)}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Amount</div>
                                    </div>
                                </div>

                                {/* Expanded Transaction Details */}
                                {isExpanded && (
                                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-50/80 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-black text-gray-400 uppercase tracking-tighter text-[10px]">#</th>
                                                        <th className="px-4 py-3 text-left font-black text-gray-400 uppercase tracking-tighter text-[10px]">Date</th>
                                                        <th className="px-4 py-3 text-left font-black text-gray-400 uppercase tracking-tighter text-[10px]">Time</th>
                                                        <th className="px-4 py-3 text-left font-black text-gray-400 uppercase tracking-tighter text-[10px]">Qty</th>
                                                        <th className="px-4 py-3 text-left font-black text-gray-400 uppercase tracking-tighter text-[10px]">Items</th>
                                                        <th className="px-4 py-3 text-right font-black text-gray-400 uppercase tracking-tighter text-[10px]">Amount</th>
                                                        <th className="px-4 py-3 text-center font-black text-gray-400 uppercase tracking-tighter text-[10px]">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                {group.entries.map((entry) => {
                                                        const p = parseLedgerNote(entry.note);
                                                        const ordNum = entry.orderNumber || (p.orderNumber !== '-' ? p.orderNumber : '-');

                                                        return (
                                                            <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-4 py-3 font-mono font-bold text-gray-600 text-[11px]">
                                                                    {ordNum}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">
                                                                    {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">
                                                                    {formatTime(entry.date)}
                                                                </td>
                                                                <td className="px-4 py-3 font-bold text-gray-900">
                                                                    {entry.quantity !== undefined && entry.quantity !== null ? entry.quantity : (p.qty !== '-' ? p.qty : "-")}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="max-w-[200px] truncate font-medium text-gray-900" title={entry.note}>
                                                                        {p.itemName !== '-' ? p.itemName : (entry.note?.split('\n')[0] || "-")}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                                                                    {formatCurrency(entry.amount)}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {entry.status !== 'closed' && p.itemName !== '-' && p.qty !== '-' && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    // Calculate actual rate from this specific transaction
                                                                                    // This is important because same item from different suppliers has different rates
                                                                                    const transactionRate = entry.quantity && entry.amount 
                                                                                        ? entry.amount / entry.quantity 
                                                                                        : 0;
                                                                                    
                                                                                    // Use entry.quantity (current) instead of p.qty (original) to show updated quantity
                                                                                    const currentQty = entry.quantity !== undefined && entry.quantity !== null ? entry.quantity : parseFloat(p.qty.split(' ')[0]);
                                                                                    
                                                                                    setSelectedItemForRemoval({
                                                                                        ledgerId: entry.id,
                                                                                        item: {
                                                                                            name: p.itemName,
                                                                                            qty: `${currentQty} pc`,
                                                                                            rate: p.qty
                                                                                        },
                                                                                        purchasePrice: transactionRate
                                                                                    });
                                                                                    setShowRemoveModal(true);
                                                                                } catch (err) {
                                                                                    console.error("Failed to open removal modal:", err);
                                                                                }
                                                                            }}
                                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-all"
                                                                            title="Remove from transaction"
                                                                        >
                                                                            <MinusIcon className="h-4 w-4" />
                                                                        </button>
                                                                    )}
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
                    })}
                </div>
            )}
        </div>

        {/* Remove Item Modal */}
        <RemoveTransactionItemModal
            isOpen={showRemoveModal}
            item={selectedItemForRemoval?.item || null}
            purchasePrice={selectedItemForRemoval?.purchasePrice}
            isLoading={removingItem}
            onConfirm={handleRemoveItem}
            onCancel={() => {
                setShowRemoveModal(false);
                setSelectedItemForRemoval(null);
            }}
        />
    </>
    );
}
