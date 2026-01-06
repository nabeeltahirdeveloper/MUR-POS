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

interface LedgerPendingTableProps {
    data: LedgerEntry[];
    onEdit: (id: string | number) => void;
    onDelete: (id: string | number) => void;
    loading?: boolean;
}

export default function LedgerPendingTable({
    data,
    onEdit,
    onDelete,
    loading,
}: LedgerPendingTableProps) {
    const [currency, setCurrency] = React.useState({ symbol: "Rs.", position: "prefix" });

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
        let advance = 0;
        let remaining = 0;

        lines.forEach(line => {
            if (line.startsWith("Order #")) {
                orderNumber = line.replace("Order #", "").trim();
            }
            else if (line.startsWith("Customer: ")) {
                title = line.replace("Customer: ", "").trim();
            }
            else if (line.startsWith("Supplier: ")) {
                title = line.replace("Supplier: ", "").trim();
            }
            else if (line.startsWith("Item: ")) {
                // Regex to handle "Item: [Type] Name (Qty: X @ Y)" or "Item: Name (Qty: ...)"
                const match = line.match(/Item:\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*\(Qty:\s*([\d\.]+)\s*@\s*([^)]*)\)/);
                if (match) {
                    // match[2] is name (Group 2)
                    // match[1] is Type (Group 1)
                    itemName = match[2].trim();
                    let itemType = match[1] || null;

                    if (itemName.startsWith("[") && !itemType) {
                        const endBracket = itemName.indexOf(']');
                        if (endBracket > 0) {
                            itemName = itemName.substring(endBracket + 1).trim();
                        }
                    }
                } else {
                    itemName = line.replace("Item: ", "").trim();
                }
            }
            else if (line.startsWith("Advance: ")) {
                advance = Number(line.replace("Advance: ", "").trim()) || 0;
            }
            else if (line.startsWith("Remaining: ")) {
                remaining = Number(line.replace("Remaining: ", "").trim()) || 0;
            }
        });

        return { orderNumber, title, itemName, advance, remaining };
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
            render: (_: any, row: LedgerEntry) => {
                const { orderNumber } = parsePendingDetails(row.note);
                return <span className="text-gray-600 font-medium">{orderNumber}</span>;
            },
        },
        {
            key: "title",
            header: "Customer",
            render: (_: any, row: LedgerEntry) => {
                const { title } = parsePendingDetails(row.note);
                return <span className="text-gray-900 font-medium">{title}</span>;
            },
        },
        {
            key: "item",
            header: "Item",
            render: (_: any, row: LedgerEntry) => {
                const { itemName } = parsePendingDetails(row.note);
                return <span className="text-gray-900 font-medium">{itemName}</span>;
            },
        },
        {
            key: "amount",
            header: "Total Bill",
            render: (value: any, row: LedgerEntry) => (
                <span className="font-mono font-bold text-gray-900 block text-right">
                    {formatCurrency(value)}
                </span>
            ),
        },
        {
            key: "advance",
            header: "Advance",
            render: (_: any, row: LedgerEntry) => {
                const { advance } = parsePendingDetails(row.note);
                return <span className="font-mono font-bold text-green-600 block text-right">{formatCurrency(advance)}</span>;
            },
        },
        {
            key: "remaining",
            header: "Remaining",
            render: (_: any, row: LedgerEntry) => {
                const { remaining } = parsePendingDetails(row.note);
                return <span className="font-mono font-bold text-red-600 block text-right">{formatCurrency(remaining)}</span>;
            },
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: LedgerEntry) => (
                <div className="flex gap-2">
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
        <Table
            data={data}
            columns={columns}
            emptyMessage="No pending payments found."
        />
    );
}
