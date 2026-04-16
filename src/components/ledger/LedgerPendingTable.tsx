"use client";

import React from "react";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { useAlert } from "@/contexts/AlertContext";
import { parsePendingDetails } from "@/lib/transaction-parser";

type LedgerEntry = {
    id: string | number;
    type: "debit" | "credit";
    amount: number | string;
    category: { name: string } | null;
    note: string | null;
    date: string; // ISO string
};

interface PartySummary {
    name: string;
    balance: number;
    totalCredit: number;
    totalDebit: number;
}

interface LedgerPendingTableProps {
    data: LedgerEntry[];
    onEdit: (id: string | number) => void;
    onDelete: (id: string | number) => void;
    onDeleteMultiple?: (ids: (string | number)[]) => void;
    loading?: boolean;
    onHistoryClick?: (name: string) => void;
}

export default function LedgerPendingTable({
    data,
    onEdit,
    onDelete,
    onDeleteMultiple,
    loading,
    onHistoryClick
}: LedgerPendingTableProps) {
    const { showConfirm } = useAlert();
    const [currency, setCurrency] = React.useState({ symbol: "Rs.", position: "prefix" });
    const [historyModal, setHistoryModal] = React.useState<{ isOpen: boolean, name: string, entries: any[] }>({ isOpen: false, name: '', entries: [] });
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [balanceMap, setBalanceMap] = React.useState<Record<string, PartySummary>>({});

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

    // Fetch computed balances from the balance APIs (source of truth)
    React.useEffect(() => {
        const fetchBalances = async () => {
            try {
                const [supRes, custRes] = await Promise.all([
                    fetch("/api/ledger/suppliers"),
                    fetch("/api/ledger/customers")
                ]);
                const map: Record<string, PartySummary> = {};
                if (supRes.ok) {
                    const suppliers: PartySummary[] = await supRes.json();
                    suppliers.forEach(s => { map[s.name.trim().toLowerCase()] = s; });
                }
                if (custRes.ok) {
                    const customers: PartySummary[] = await custRes.json();
                    customers.forEach(c => { map[c.name.trim().toLowerCase()] = c; });
                }
                setBalanceMap(map);
            } catch (e) {
                console.error("Failed to fetch balances", e);
            }
        };
        fetchBalances();
    }, [data]);

    const formatCurrency = (value: number | string) => {
        const num = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return currency.position === "prefix" ? `${currency.symbol} ${num}` : `${num} ${currency.symbol}`;
    };

    // parsePendingDetails imported from @/lib/transaction-parser

    // Group data by Customer/Supplier Name to show the correct remaining balance per person
    const groupedData = React.useMemo(() => {
        const groups: Record<string, {
            ids: (string | number)[];
            date: string;
            orderNumber: string;
            customerName: string;
            items: string[];
            totalItemBill: number;
            remaining: number;
            rawNote: string;
            type: "debit" | "credit";
            latestEntryId: number;
        }> = {};

        // Sort data by date DESC, then by id DESC to break ties on same date
        const sortedData = [...data].sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return Number(b.id) - Number(a.id);
        });

        sortedData.forEach(entry => {
            const details = parsePendingDetails(entry.note);
            const key = details.title !== "-" ? details.title : `UNKNOWN-${entry.id}`;
            const isPaymentOnly = (entry.note || "").includes("Direct Payment");
            const entryId = Number(entry.id) || 0;

            if (!groups[key]) {
                groups[key] = {
                    ids: [],
                    date: entry.date,
                    orderNumber: details.orderNumber,
                    customerName: details.title,
                    items: [],
                    totalItemBill: 0,
                    remaining: details.remaining || 0,
                    rawNote: entry.note || "",
                    type: entry.type,
                    latestEntryId: entryId
                };
            }

            groups[key].ids.push(entry.id);
            if (details.itemName !== "-") {
                groups[key].items.push(details.itemName);
            }

            // Only count item/purchase amounts toward total bill, not direct payment entries
            if (!isPaymentOnly) {
                groups[key].totalItemBill += Number(entry.amount);
            }

            // Update remaining from the most recent entry (by date + id)
            if (entryId > groups[key].latestEntryId) {
                groups[key].date = entry.date;
                groups[key].orderNumber = details.orderNumber;
                groups[key].remaining = details.remaining || 0;
                groups[key].rawNote = entry.note || "";
                groups[key].latestEntryId = entryId;
            }
        });

        // Convert to array — use computed balance from API (source of truth)
        return Object.values(groups).map((g) => {
            const lookupKey = g.customerName.trim().toLowerCase();
            const computed = balanceMap[lookupKey];

            // Use computed balance if available, else fall back to note-based
            const remaining = computed ? computed.balance : g.remaining;
            const totalBill = g.totalItemBill || (remaining > 0 ? remaining : 0);
            const paid = Math.max(0, totalBill - remaining);

            return {
                ...g,
                id: g.ids[0],
                totalBill,
                advance: paid,
                remaining,
                itemSummary: Array.from(new Set(g.items)).join(", ")
            };
        }).filter(g => g.remaining > 0); // Only show entries that actually have a pending balance
    }, [data, balanceMap]);

    const handleGroupDelete = async (ids: (string | number)[]) => {
        if (onDeleteMultiple) {
            onDeleteMultiple(ids);
        } else {
            if (await showConfirm(`Delete this entire bill (${ids.length} items)?`, { variant: "danger" })) {
                ids.forEach(id => onDelete(id));
            }
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
            header: "CUSTOMER / SUPPLIER",
            render: (_: any, row: any) => {
                const isCashIn = row.type === 'credit';
                return (
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isCashIn ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>
                            {isCashIn ? 'IN' : 'OUT'}
                        </span>
                        <span className="text-gray-900 font-bold">{row.customerName}</span>
                    </div>
                );
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
                return (
                    <span className="font-mono font-bold text-gray-900 block text-right">
                        {formatCurrency(row.totalBill)}
                    </span>
                );
            },
        },
        {
            key: "advance",
            header: "paid",
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
            header: <div className="text-center">Actions</div>,
            render: (_: any, row: any) => (
                <div className="flex items-center justify-center gap-2 min-w-[320px]">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-3 rounded-lg text-xs font-black uppercase tracking-tight hover:bg-white hover:text-primary transition-all border border-gray-200"
                        onClick={() => fetchHistory(row.customerName)}
                        title="View Audit Trail"
                    >
                        History
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-3 rounded-lg text-xs font-black uppercase tracking-tight hover:bg-gray-200 transition-all border border-gray-200"
                        onClick={() => {
                            const ids = row.ids.join(',');
                            window.open(`/ledger/receipt/batch?ids=${ids}`, '_blank');
                        }}
                        title="Print Batch Bill"
                    >
                        Print
                    </Button>
                    <Button
                        size="sm"
                        variant="primary"
                        className="h-8 px-3 rounded-lg text-xs font-black uppercase tracking-tight bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm"
                        onClick={async () => {
                            if (await showConfirm("Mark this entire bill as fully paid?", { variant: "info", title: "Settle Payment" })) {
                                try {
                                    await Promise.all(row.ids.map(async (id: string | number) => {
                                        const res = await fetch(`/api/ledger/${id}`);
                                        if (res.ok) {
                                            const data = await res.json();
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
                                    window.location.reload();
                                } catch (e) {
                                    console.error("Failed to mark paid", e);
                                }
                            }
                        }}
                        title="Mark as Fully Settled"
                    >
                        Mark Paid
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        className="h-8 px-3 rounded-lg text-xs font-black uppercase tracking-tight bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm"
                        onClick={() => handleGroupDelete(row.ids)}
                        title="Delete Entire Bill"
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
                                                    {historyModal.entries
                                                        .map((h: any, idx: number, arr: any[]) => {
                                                            const pParsed = parsePendingDetails(h.note);
                                                            const paid = pParsed.advance !== undefined ? pParsed.advance :
                                                                (pParsed.orderNumber !== "-" ? 0 : (Number(h.amount) || 0));
                                                            let remaining = pParsed.remaining || 0;

                                                            // For the LATEST entry (first in desc-sorted list), use computed balance
                                                            const isLatest = idx === 0;
                                                            if (isLatest) {
                                                                const lookupKey = historyModal.name.trim().toLowerCase();
                                                                const computed = balanceMap[lookupKey];
                                                                if (computed) remaining = computed.balance;
                                                            }

                                                            const total = paid + remaining;
                                                            return { h, pParsed, paid, remaining, total };
                                                        })
                                                        .filter(({ total }) => total > 0)
                                                        .map(({ h, pParsed, paid, remaining, total }) => (
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
                                                        ))}
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
