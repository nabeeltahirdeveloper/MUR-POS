"use client";

import React from "react";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { useAlert } from "@/contexts/AlertContext";

type LedgerEntry = {
    id: string | number;
    type: "debit" | "credit";
    amount: number | string;
    category: { name: string } | null;
    note: string | null;
    date: string; // ISO string
};

interface LedgerPendingTableProps {
    data: LedgerEntry[];
    onEdit: (id: string | number) => void;
    onDelete: (id: string | number) => void;
    loading?: boolean;
    onHistoryClick?: (name: string) => void;
}

export default function LedgerPendingTable({
    data,
    onEdit,
    onDelete,
    loading,
    onHistoryClick
}: LedgerPendingTableProps) {
    const { showConfirm } = useAlert();
    const [currency, setCurrency] = React.useState({ symbol: "Rs.", position: "prefix" });
    const [historyModal, setHistoryModal] = React.useState<{ isOpen: boolean, name: string, entries: any[] }>({ isOpen: false, name: '', entries: [] });
    const [historyLoading, setHistoryLoading] = React.useState(false);

    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    if (data?.currency) {
                        setCurrency(data.currency);
                    }
                }
            } catch (error) {
                // ignore
            }
        };
        fetchSettings();
    }, []);

    const formatCurrency = (value: number | string) => {
        const num = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return currency.position === "prefix" ? `${currency.symbol} ${num}` : `${num} ${currency.symbol}`;
    };

    // Helper to parse extended details including Advance and Remaining
    const parsePendingDetails = (note: string | null) => {
        if (!note) return { orderNumber: "-", title: "-", itemName: "-", advance: 0, remaining: 0 };

        const lines = note.split('\n');
        let orderNumber = "-";
        let title = "-";
        let itemName = "-";
        let advance: number | undefined = undefined;
        let remaining: number | undefined = undefined;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith("Order #")) {
                orderNumber = trimmed.replace("Order #", "").trim();
            }
            else if (trimmed.startsWith("Customer: ")) {
                title = trimmed.replace("Customer: ", "").trim();
            }
            else if (trimmed.startsWith("Supplier: ")) {
                title = trimmed.replace("Supplier: ", "").trim();
            }
            else if (trimmed.startsWith("Item: ")) {
                const match = trimmed.match(/Item:\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*\(Qty:\s*([\d\.]+).*?@\s*([^)]*)\)/);
                if (match) {
                    itemName = match[2].trim();
                } else {
                    itemName = trimmed.replace("Item: ", "").trim();
                }
            }

            // Robust regex for Advance/Payment and Remaining
            const advMatch = trimmed.match(/^(Advance|Payment|Adjustment):\s*([\d\.]+)/i);
            if (advMatch) advance = Number(advMatch[2]) || 0;

            const remMatch = trimmed.match(/Remaining:\s*([\d\.]+)/i);
            if (remMatch) {
                remaining = Number(remMatch[1]);
            }
        });

        return { orderNumber, title, itemName, advance, remaining };
    };

    // Group data by Customer/Supplier Name to show only the latest remaining balance per person
    const groupedData = React.useMemo(() => {
        const groups: Record<string, {
            ids: (string | number)[];
            date: string;
            orderNumber: string;
            customerName: string;
            items: string[];
            totalBill: number;
            advance: number;
            remaining: number;
            rawNote: string;
        }> = {};

        // Sort data by date descending to ensure we start with the latest
        const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        sortedData.forEach(entry => {
            const details = parsePendingDetails(entry.note);
            // Unique Key: Person Name (title)
            const key = details.title !== "-" ? details.title : `UNKNOWN-${entry.id}`;

            if (!groups[key]) {
                groups[key] = {
                    ids: [],
                    date: entry.date,
                    orderNumber: details.orderNumber,
                    customerName: details.title,
                    items: [],
                    totalBill: 0,
                    advance: details.advance || 0,
                    remaining: details.remaining || 0,
                    rawNote: entry.note || ""
                };
            }

            groups[key].ids.push(entry.id);
            if (details.itemName !== "-") {
                groups[key].items.push(details.itemName);
            }
            groups[key].totalBill += Number(entry.amount);

            // If entry is newer than current group date, update meta-info (like Remaining)
            if (new Date(entry.date).getTime() > new Date(groups[key].date).getTime()) {
                groups[key].date = entry.date;
                groups[key].orderNumber = details.orderNumber;
                groups[key].advance = details.advance || 0;
                groups[key].remaining = details.remaining || 0;
                groups[key].rawNote = entry.note || "";
            }
        });

        // Convert to array
        return Object.values(groups).map((g) => ({
            ...g,
            id: g.ids[0], // Use first ID as row key for Table
            itemSummary: Array.from(new Set(g.items)).join(", ") // Deduplicate item names
        }));
    }, [data]);

    const handleGroupDelete = async (ids: (string | number)[]) => {
        if (await showConfirm(`Delete this entire bill (${ids.length} items)?`, { variant: "danger" })) {
            ids.forEach(id => onDelete(id));
        }
    };

    const fetchHistory = async (name: string) => {
        setHistoryLoading(true);
        setHistoryModal({ isOpen: true, name, entries: [] });
        try {
            const res = await fetch(`/api/ledger?search=${encodeURIComponent(name)}&limit=100`);
            if (res.ok) {
                const data = await res.json();
                setHistoryModal(prev => ({ ...prev, entries: data.data || [] }));
            }
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setHistoryLoading(false);
        }
    };


    const columns = [
        {
            key: "date",
            header: "Date",
            render: (value: any) => new Date(value).toLocaleDateString(),
        },
        {
            key: "order",
            header: "#",
            render: (_: any, row: any) => {
                return <span className="text-gray-600 font-medium">{row.orderNumber}</span>;
            },
        },
        {
            key: "title",
            header: "Customer",
            render: (_: any, row: any) => {
                return <span className="text-gray-900 font-medium">{row.customerName}</span>;
            },
        },
        {
            key: "item",
            header: "Items",
            render: (_: any, row: any) => {
                return (
                    <div className="max-w-[200px] truncate" title={row.itemSummary}>
                        <span className="text-gray-900 font-medium">{row.items.length > 1 ? `(${row.items.length}) ` : ""}{row.itemSummary}</span>
                    </div>
                );
            },
        },
        {
            key: "amount",
            header: "Total Bill",
            render: (_: any, row: any) => {
                // Math: Total Bill = Paid + Remaining (to show the account state as requested)
                const stateTotal = row.advance + row.remaining;
                return (
                    <span className="font-mono font-bold text-gray-900 block text-right">
                        {formatCurrency(stateTotal > 0 ? stateTotal : row.totalBill)}
                    </span>
                );
            },
        },
        {
            key: "advance",
            header: "Advance",
            render: (_: any, row: any) => {
                return <span className="font-mono font-bold text-green-600 block text-right">{formatCurrency(row.advance)}</span>;
            },
        },
        {
            key: "remaining",
            header: "Remaining",
            render: (_: any, row: any) => {
                return <span className="font-mono font-bold text-red-600 block text-right">{formatCurrency(row.remaining)}</span>;
            },
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: any) => (
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => fetchHistory(row.customerName)}
                        title="View History"
                    >
                        History
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                            const ids = row.ids.join(',');
                            window.open(`/ledger/receipt/batch?ids=${ids}`, '_blank');
                        }}
                        title="Print Bill"
                    >
                        Print
                    </Button>
                    <Button
                        size="sm"
                        variant="primary"
                        className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                        onClick={async () => {
                            if (await showConfirm("Mark this bill as fully paid? This will update the status and net balance.", { variant: "info", title: "Settle Payment" })) {
                                try {
                                    // Update all items in the group to remove "Remaining" from note
                                    await Promise.all(row.ids.map(async (id: string | number) => {
                                        const res = await fetch(`/api/ledger/${id}`);
                                        if (res.ok) {
                                            const data = await res.json();
                                            // Remove Remaining line, keep Advance for history?
                                            // Or remove both? Let's remove Remaining only to clear "Pending" status.
                                            // Remove BOTH "Remaining: " AND "Advance: " lines to ensure receipt shows fully paid (Standard Invoice)
                                            // The user reported "same receipt shown", meaning it still showed as pending/advance.
                                            // Removing these lines makes parseTransactionNote return undefined for advance/remaining.
                                            const newNote = (data.note || "")
                                                .split('\n')
                                                .filter((line: string) => !line.startsWith("Remaining: ") && !line.startsWith("Advance: "))
                                                .join('\n');

                                            await fetch(`/api/ledger/${id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ ...data, note: newNote, markPaid: true })
                                            });
                                        }
                                    }));
                                    // Refresh by reloading or callback? 
                                    // Since we don't have a refresh callback in props easily, we might rely on parent re-render or reload.
                                    // But onEdit/onDelete triggers parent update? onDelete does.
                                    // Let's reuse onDelete to trigger refresh? No, that deletes it.
                                    // Ideally we need onUpdate callback.
                                    // For now, simple window reload or forcing update.
                                    window.location.reload();
                                } catch (e) {
                                    console.error("Failed to mark paid", e);
                                }
                            }
                        }}
                        title="Mark as Fully Paid"
                    >
                        Mark Paid
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleGroupDelete(row.ids)}
                    >
                        Delete
                    </Button>
                </div>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="relative">
            <Table
                data={groupedData}
                columns={columns}
                emptyMessage="No pending payments found."
            />

            {/* History Modal */}
            {historyModal.isOpen && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">Transaction History</h3>
                                <p className="text-sm font-medium text-gray-500 mt-1">Audit trail for {historyModal.name}</p>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setHistoryModal({ ...historyModal, isOpen: false })}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {historyLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                                    <p className="text-sm text-gray-500 font-medium">Fetching records...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historyModal.entries.length > 0 ? (
                                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 font-bold text-gray-900">Date</th>
                                                        <th className="px-4 py-3 font-bold text-gray-900 border-l border-gray-100 italic">#</th>
                                                        <th className="px-4 py-3 font-bold text-gray-900 text-right">Paid</th>
                                                        <th className="px-4 py-3 font-bold text-gray-900 text-right">Remaining</th>
                                                        <th className="px-4 py-3 font-bold text-gray-900 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {historyModal.entries.map((h: any) => {
                                                        const pParsed = parsePendingDetails(h.note);
                                                        // Fallback logic: 
                                                        // 1. If Advance is explicitly in the note (even 0), use it.
                                                        // 2. If no Advance line but it's a structured note, default to 0 paid.
                                                        // 3. If it's an old unstructured note, use the row amount.
                                                        const paid = pParsed.advance !== undefined ? pParsed.advance :
                                                            (pParsed.orderNumber !== "-" ? 0 : (Number(h.amount) || 0));
                                                        const remaining = pParsed.remaining || 0;
                                                        const total = paid + remaining;

                                                        return (
                                                            <tr key={h.id} className="hover:bg-gray-50/80 transition-colors">
                                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(h.date).toLocaleDateString()}</td>
                                                                <td className="px-4 py-3 text-gray-900 font-medium border-l border-gray-50 italic">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-1 py-0.5 rounded text-[8px] font-black uppercase ${h.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                            {h.type === 'credit' ? 'In' : 'Out'}
                                                                        </span>
                                                                        {pParsed.orderNumber || "-"}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-green-600">
                                                                    {formatCurrency(paid)}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-red-600">
                                                                    {formatCurrency(remaining)}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                                                                    {formatCurrency(total)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-500 font-medium">No historical records found.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                            <Button onClick={() => setHistoryModal({ ...historyModal, isOpen: false })}>Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
