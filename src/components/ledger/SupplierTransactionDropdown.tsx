"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, PrinterIcon, LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useAlert } from "@/contexts/AlertContext";

interface LedgerEntry {
    id: string;
    date: string;
    amount: number;
    type: 'debit' | 'credit';
    status?: 'open' | 'closed';
    note?: string;
    orderNumber?: number;
}

interface SupplierTransactionDropdownProps {
    supplierName: string;
}

interface DateGroup {
    date: string;
    entries: LedgerEntry[];
    itemCount: number;
    total: number;
    orderNumber?: number;
    transactionCount?: number;
}

export function SupplierTransactionDropdown({ supplierName }: SupplierTransactionDropdownProps) {
    const { showConfirm } = useAlert();
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewLevel, setViewLevel] = useState<'years' | 'months' | 'dates'>('years');
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchEntries();
    }, [supplierName]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/ledger?search=Supplier: ${encodeURIComponent(supplierName)}&limit=1000`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch supplier entries:", error);
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
        const dateGroups: Record<string, Record<string, LedgerEntry[]>> = {};

        entries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString();
            const groupKey = entry.orderNumber ? `order-${entry.orderNumber}` : `entry-${entry.id}`;

            if (!dateGroups[date]) {
                dateGroups[date] = {};
            }
            if (!dateGroups[date][groupKey]) {
                dateGroups[date][groupKey] = [];
            }
            dateGroups[date][groupKey].push(entry);
        });

        const result: DateGroup[] = [];
        Object.entries(dateGroups).forEach(([date, groups]) => {
            const transactionCount = Object.keys(groups).length; // Count unique transactions for this date
            Object.entries(groups).forEach(([groupKey, groupEntries]) => {
                result.push({
                    date,
                    entries: groupEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                    itemCount: groupEntries.length,
                    total: groupEntries.reduce((sum, e) => sum + e.amount, 0),
                    orderNumber: groupEntries[0].orderNumber,
                    transactionCount: transactionCount
                });
            });
        });

        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const calculateTotal = (entries: LedgerEntry[]): number => {
        return entries.reduce((sum, entry) => sum + entry.amount, 0);
    };

    const parseLedgerNote = (note: string | undefined): { itemDetails: { name: string; qty: string; rate: string } | null; paymentMethod: string | null; advance: string; remaining: string } => {
        if (!note) return { itemDetails: null, paymentMethod: null, advance: '-', remaining: '-' };

        const lines = note.split('\n');
        let paymentMethod: string | null = null;
        let itemDetails: { name: string; qty: string; rate: string } | null = null;
        let advance = '-';
        let remaining = '-';

        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.startsWith("payment: ")) {
                paymentMethod = line.substring("payment: ".length).trim();
            } else if (lowerLine.startsWith("advance: ")) {
                advance = line.substring("advance: ".length).trim();
            } else if (lowerLine.startsWith("remaining: ")) {
                remaining = line.substring("remaining: ".length).trim();
            } else if (lowerLine.startsWith("item: ")) {
                const raw = line.substring("item: ".length).trim();
                const match = raw.match(/^(?:\[.*?\]\s*)?(.*?)\s*\(Qty:\s*(.*?)\s*@\s*(.*?)\)$/i);
                if (match) {
                    itemDetails = {
                        name: match[1].trim(),
                        qty: match[2].trim(),
                        rate: match[3].trim(),
                    };
                }
            }
        });

        return {
            itemDetails,
            paymentMethod,
            advance: advance !== '-' ? Number(advance).toLocaleString() : '-',
            remaining: remaining !== '-' ? Number(remaining).toLocaleString() : '-'
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
                No transactions found for this supplier.
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

    return (
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
                            <span className="text-lg font-bold text-blue-600">Rs. {total.toLocaleString()}</span>
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
                            <span className="text-lg font-bold text-blue-600">Rs. {total.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Dates View (existing date grouping) */}
            {viewLevel === 'dates' && selectedYear && selectedMonth && (
                <div className="divide-y divide-gray-200">
                    {dateGroups.map((group) => {
                        const isExpanded = expandedDates.has(group.date);
                        return (
                            <div key={group.date}>
                                {/* Date Header Row */}
                                <div
                                    className="flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-150 cursor-pointer"
                                    onClick={() => toggleDate(group.date)}
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? (
                                            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                        ) : (
                                            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                                        )}
                                        <span className="font-medium text-gray-900">{group.date}</span>
                                        <span className="text-sm text-gray-500">
                                            ({group.transactionCount} {group.transactionCount === 1 ? 'transaction' : 'transactions'})
                                        </span>
                                    </div>
                                    <div className="text-sm font-semibold text-gray-900">
                                        Rs. {group.total.toLocaleString()}
                                    </div>
                                </div>

                                {/* Expanded Transaction Details */}
                                {isExpanded && (
                                    <div className="bg-white">
                                        <table className="min-w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Advance</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(() => {
                                                    // Consolidate all entries in this group into one row
                                                    const firstEntry = group.entries[0];

                                                    // Use formatItemNames which already handles the condensed format
                                                    const allNotes = group.entries.map(e => e.note).join('\n');
                                                    const consolidatedItemNames = formatItemNames(allNotes);

                                                    // Calculate total quantity (sum of all quantities)
                                                    let totalQty = 0;
                                                    let qtyUnit = '';
                                                    group.entries.forEach(e => {
                                                        const parsed = parseLedgerNote(e.note);
                                                        if (parsed.itemDetails?.qty) {
                                                            // Extract number from qty string (e.g., "3 pc" -> 3)
                                                            const match = parsed.itemDetails.qty.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
                                                            if (match) {
                                                                totalQty += parseFloat(match[1]);
                                                                if (!qtyUnit && match[2]) {
                                                                    qtyUnit = match[2]; // Use first unit found
                                                                }
                                                            }
                                                        }
                                                    });
                                                    const consolidatedQty = totalQty > 0 ? `${totalQty}${qtyUnit ? ' ' + qtyUnit : ''}` : '-';

                                                    // Get advance and remaining from first entry (they should be same for all)
                                                    const parsed = parseLedgerNote(firstEntry.note);

                                                    return (
                                                        <tr key={group.entries.map(e => e.id).join('-')} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap font-mono">
                                                                {firstEntry.orderNumber || '-'}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                                                                {formatTime(firstEntry.date)}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">
                                                                {consolidatedItemNames}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                                                                {consolidatedQty}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap font-medium">
                                                                Rs. {group.total.toLocaleString()}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                                                                {parsed.advance}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                                                                {parsed.remaining}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm whitespace-nowrap">
                                                                <div className="flex gap-2">
                                                                    {/* Print Receipt */}
                                                                    <Link
                                                                        href={`/ledger/receipt/${firstEntry.id}`}
                                                                        className="text-gray-500 hover:text-gray-900 transition-colors"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        target="_blank"
                                                                        title="Print Receipt"
                                                                    >
                                                                        <PrinterIcon className="h-4 w-4" />
                                                                    </Link>

                                                                    {/* Status Toggle */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleStatus(firstEntry);
                                                                        }}
                                                                        className={`transition-colors ${firstEntry.status === 'closed' ? 'text-blue-500 hover:text-blue-700' : 'text-gray-500 hover:text-red-600'}`}
                                                                        title={firstEntry.status === 'closed' ? 'Re-open Transaction' : 'Close Transaction'}
                                                                    >
                                                                        {firstEntry.status === 'closed' ? (
                                                                            <LockOpenIcon className="h-4 w-4" />
                                                                        ) : (
                                                                            <LockClosedIcon className="h-4 w-4" />
                                                                        )}
                                                                    </button>

                                                                    {/* Edit */}
                                                                    {firstEntry.status !== 'closed' && (
                                                                        <Link
                                                                            href={`/ledger/${firstEntry.id}/edit`}
                                                                            className="text-blue-500 hover:text-blue-700 transition-colors"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            title="Edit Transaction"
                                                                        >
                                                                            <PencilSquareIcon className="h-4 w-4" />
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
