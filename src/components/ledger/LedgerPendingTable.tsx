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
}

export default function LedgerPendingTable({
    data,
    onEdit,
    onDelete,
    loading,
}: LedgerPendingTableProps) {
    const { showConfirm } = useAlert();
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

    // Group data by Order Number or (Date + Customer)
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

        data.forEach(entry => {
            const details = parsePendingDetails(entry.note);
            // Unique Key: OrderNumber if exists, else Date+Customer
            const key = details.orderNumber !== "-"
                ? `ORD-${details.orderNumber}`
                : `DATE-${entry.date.split('T')[0]}-CUS-${details.title}`;

            if (!groups[key]) {
                groups[key] = {
                    ids: [],
                    date: entry.date,
                    orderNumber: details.orderNumber,
                    customerName: details.title,
                    items: [],
                    totalBill: 0,
                    // One-time capture of bill-level fields (Advance/Remaining are pre-calculated per bill in the note)
                    advance: details.advance,
                    remaining: details.remaining,
                    rawNote: entry.note || ""
                };
            }

            groups[key].ids.push(entry.id);
            groups[key].items.push(details.itemName);
            groups[key].totalBill += Number(entry.amount);
            // Note: We don't sum remaining/advance because the note repeats the *bill total* remaining/advance for every item.
        });

        // Convert to array
        return Object.values(groups).map((g, index) => ({
            ...g,
            id: g.ids[0], // Use first ID as row key
            itemSummary: g.items.join(", ")
        }));
    }, [data]);

    const handleGroupDelete = async (ids: (string | number)[]) => {
        if (await showConfirm(`Delete this entire bill (${ids.length} items)?`, { variant: "danger" })) {
            ids.forEach(id => onDelete(id));
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
            render: (_: any, row: any) => (
                <span className="font-mono font-bold text-gray-900 block text-right">
                    {formatCurrency(row.totalBill)}
                </span>
            ),
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
                        variant="secondary"
                        onClick={() => onEdit(row.id)} // Edits just the first item for now, or we need a batch edit page
                        title="Edit First Item (Batch Edit WIP)"
                    >
                        Edit
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
        <Table
            data={groupedData}
            columns={columns}
            emptyMessage="No pending payments found."
        />
    );
}
