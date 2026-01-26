"use client";

import React from "react";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";

type LedgerEntry = {
    id: string | number;
    type: "debit" | "credit";
    amount: number | string;
    category: { name: string } | null;
    note: string | null;
    date: string; // ISO string
};

interface LedgerTableProps {
    data: LedgerEntry[];
    onEdit: (id: string | number) => void;
    onDelete: (id: string | number) => void;
    loading?: boolean;
    selectedIds?: (string | number)[];
    onSelectionChange?: (ids: (string | number)[]) => void;
}

export default function LedgerTable({
    data,
    onEdit,
    onDelete,
    loading,
    selectedIds = [],
    onSelectionChange,
}: LedgerTableProps) {
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

    // Helper to parse existing notes based on the standardized format
    const parseTransactionNote = (note: string | null) => {
        if (!note) return { orderNumber: "-", title: "-", itemName: "-", quantity: null, unitPrice: null, isStructured: false, itemType: null, advance: undefined as number | undefined, remaining: undefined as number | undefined };

        const lines = note.split('\n');
        let orderNumber = "";
        let title = "";
        let itemName = "";
        let quantity: number | null = null;
        let unitPrice: number | null = null;
        let isStructured = false;
        let itemType: string | null = null;
        let advance: number | undefined = undefined;
        let remaining: number | undefined = undefined;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith("Order #")) {
                orderNumber = trimmed.replace("Order #", "").trim();
                isStructured = true;
            }
            else if (trimmed.startsWith("Customer: ")) {
                title = trimmed.replace("Customer: ", "").trim();
                isStructured = true;
            }
            else if (trimmed.startsWith("Supplier: ")) {
                title = trimmed.replace("Supplier: ", "").trim();
                isStructured = true;
            }
            else if (trimmed.startsWith("Item: ")) {
                isStructured = true;
                const match = trimmed.match(/Item:\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*\(Qty:\s*([\d\.]+).*?@\s*([^)]*)\)/);
                if (match) {
                    itemType = match[1] || null;
                    itemName = match[2].trim();
                    quantity = Number(match[3]);
                    unitPrice = Number(match[4]);
                } else {
                    itemName = trimmed.replace("Item: ", "").trim();
                }
            }
            else if (trimmed.startsWith("Details: ")) {
                isStructured = true;
                itemName = trimmed.replace("Details: ", "").trim();
            }

            // Advance/Remaining labels
            const advMatch = trimmed.match(/^(Advance|Payment|Adjustment):\s*([\d\.]+)/i);
            if (advMatch) advance = Number(advMatch[2]);

            const remMatch = trimmed.match(/Remaining:\s*([\d\.]+)/i);
            if (remMatch) remaining = Number(remMatch[1]);
        });

        if (!isStructured) {
            // ... keep existing fallback logic ...
            if (note.startsWith("[Loan] ") || note.startsWith("[Payment] ")) {
                const parts = note.split(":");
                title = parts[0].trim();
                const nameMatch = note.match(/^\[(Loan|Payment)\] (.*?):/);
                if (nameMatch) {
                    title = nameMatch[2].trim();
                    itemName = note.replace(nameMatch[0], "").trim();
                }
                if (!itemName) itemName = note.startsWith("[Payment]") ? "Loan Repayment" : "Loan Given";
                if (title.startsWith("[")) {
                    const endBracket = title.indexOf("]");
                    if (endBracket !== -1) title = title.substring(endBracket + 1).trim();
                }
            }
            else if (note.startsWith("[Bill] ")) {
                const content = note.replace("[Bill] ", "").trim();
                const separatorIndex = content.lastIndexOf(" - ");
                if (separatorIndex !== -1) {
                    title = content.substring(0, separatorIndex).trim();
                    itemName = content.substring(separatorIndex + 3).trim();
                } else {
                    title = content;
                    itemName = "Utility Bill";
                }
            }
            else {
                title = "-";
                itemName = note;
            }
        }

        return {
            orderNumber: orderNumber || "-",
            title: title || "-",
            itemName: itemName || "-",
            quantity,
            unitPrice,
            isStructured,
            itemType,
            advance,
            remaining
        };
    };

    const isVirtualEntry = (id: string | number): boolean => {
        const idStr = String(id);
        return idStr.startsWith('debt_') || idStr.startsWith('pay_') || idStr.startsWith('util_');
    };

    const toggleSelection = (id: string | number) => {
        if (!onSelectionChange) return;
        const newSelection = selectedIds.includes(id)
            ? selectedIds.filter(selectedId => selectedId !== id)
            : [...selectedIds, id];
        onSelectionChange(newSelection);
    };

    const toggleSelectAll = () => {
        if (!onSelectionChange) return;
        if (selectedIds.length === data.length && data.length > 0) {
            onSelectionChange([]);
        } else {
            onSelectionChange(data.map(d => d.id));
        }
    };

    const fetchHistory = async (name: string) => {
        if (!name || name === "-") return;
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
            key: "select",
            header: <div className="flex justify-center"><input type="checkbox" checked={data.length > 0 && selectedIds.length === data.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></div>,
            render: (_: any, row: LedgerEntry) => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelection(row.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                </div>
            ),
        },
        {
            key: "date",
            header: "Date",
            render: (value: any) => new Date(value).toLocaleDateString(),
        },
        {
            key: "order",
            header: "#",
            render: (_: any, row: LedgerEntry) => {
                const { orderNumber } = parseTransactionNote(row.note);
                return <span className="text-gray-600 font-medium">{orderNumber}</span>;
            },
        },
        {
            key: "category",
            header: "Category",
            render: (_: any, row: LedgerEntry) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {row.category?.name || "Uncategorized"}
                </span>
            ),
        },
        {
            key: "title",
            header: "Name / Title",
            render: (_: any, row: LedgerEntry) => {
                const { title } = parseTransactionNote(row.note);
                return <span className="text-gray-900 font-medium">{title}</span>;
            },
        },
        {
            key: "item",
            header: "Item / Note",
            render: (_: any, row: LedgerEntry) => {
                const { itemName, itemType } = parseTransactionNote(row.note);
                return (
                    <div className="flex items-center gap-2">
                        {itemType === "Customize" && (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold" title="Customized">
                                C
                            </span>
                        )}
                        <span className="text-gray-900 font-medium">{itemName}</span>
                    </div>
                );
            },
        },
        {
            key: "quantity",
            header: "Qty",
            render: (_: any, row: LedgerEntry) => {
                const { quantity } = parseTransactionNote(row.note);
                return <span className="text-gray-600 text-center block">{quantity || "-"}</span>;
            },
        },
        {
            key: "price",
            header: "Price",
            render: (_: any, row: LedgerEntry) => {
                const { unitPrice } = parseTransactionNote(row.note);
                return <span className="text-gray-600 text-right block font-mono">{unitPrice ? formatCurrency(unitPrice) : "-"}</span>;
            },
        },
        {
            key: "type",
            header: "Type",
            render: (value: any) => (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value === "credit"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                        }`}
                >
                    {value === "credit" ? "Cash-In" : "Cash-Out"}
                </span>
            ),
        },
        {
            key: "amount",
            header: "Amount",
            render: (value: any, row: LedgerEntry) => (
                <span className={`font-mono font-bold ${row.type === "credit" ? "text-green-600" : "text-red-600"
                    }`}>
                    {formatCurrency(value)}
                </span>
            ),
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: LedgerEntry) => {
                const isVirtual = isVirtualEntry(row.id);

                if (isVirtual) {
                    // For virtual entries
                    const idStr = String(row.id);
                    let redirectUrl = '/debts';
                    let label = 'View Loan';
                    let manageText = '(Manage in Debts)';

                    if (idStr.startsWith('util_')) {
                        redirectUrl = '/utilities'; // Assuming you have a utilities page
                        label = 'View Bill';
                        manageText = '(Manage in Utilities)';
                    }

                    return (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => window.location.href = redirectUrl}
                                title={label}
                            >
                                {label}
                            </Button>
                            <span className="text-xs text-gray-400 self-center hidden lg:inline">
                                {manageText}
                            </span>
                        </div>
                    );
                }

                // For real ledger entries, show full actions
                const { title } = parseTransactionNote(row.note);
                return (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => fetchHistory(title)}
                            disabled={!title || title === "-"}
                            title="View History"
                        >
                            History
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => window.open(`/ledger/receipt/${row.id}`, '_blank')}
                            title="Print Receipt"
                        >
                            Print
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onEdit(row.id)}
                        >
                            Edit
                        </Button>
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onDelete(row.id)}
                        >
                            Delete
                        </Button>
                    </div>
                );
            },
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
                data={data}
                columns={columns}
                emptyMessage="No ledger entries found."
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
                                                        const p = parseTransactionNote(h.note);

                                                        // Fallback logic for Paid Amount
                                                        const paid = p.advance !== undefined ? p.advance :
                                                            (p.isStructured ? 0 : (Number(h.amount) || 0));
                                                        const remaining = p.remaining || 0;
                                                        const total = paid + remaining;
                                                        return (
                                                            <tr key={h.id} className="hover:bg-gray-50/80 transition-colors">
                                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(h.date).toLocaleDateString()}</td>
                                                                <td className="px-4 py-3 text-gray-900 font-medium border-l border-gray-50 italic">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-1 py-0.5 rounded text-[8px] font-black uppercase ${h.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                            {h.type === 'credit' ? 'In' : 'Out'}
                                                                        </span>
                                                                        {p.orderNumber || "-"}
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
