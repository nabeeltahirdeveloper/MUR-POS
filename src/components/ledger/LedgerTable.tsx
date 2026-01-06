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
}

export default function LedgerTable({
    data,
    onEdit,
    onDelete,
    loading,
}: LedgerTableProps) {
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

    // Helper to parse existing notes based on the standardized format
    const parseTransactionNote = (note: string | null) => {
        if (!note) return { orderNumber: "-", title: "-", itemName: "-", quantity: null, unitPrice: null, isStructured: false };

        const lines = note.split('\n');
        let orderNumber = "";
        let title = "";
        let itemName = "";
        let quantity: number | null = null;
        let unitPrice: number | null = null;
        let isStructured = false;

        lines.forEach(line => {
            if (line.startsWith("Order #")) {
                orderNumber = line.replace("Order #", "").trim();
                isStructured = true;
            }
            else if (line.startsWith("Customer: ")) {
                title = line.replace("Customer: ", "").trim();
                isStructured = true;
            }
            else if (line.startsWith("Supplier: ")) {
                title = line.replace("Supplier: ", "").trim();
                isStructured = true;
            }
            else if (line.startsWith("Item: ")) {
                isStructured = true;
                const match = line.match(/Item: (.*) \(Qty: (\d+) @ (.*)\)/);
                if (match) {
                    itemName = match[1];
                    quantity = Number(match[2]);
                    unitPrice = Number(match[3]);
                } else {
                    itemName = line.replace("Item: ", "").trim();
                }
            }
        });

        if (!isStructured) {
            // Fallback for manual/unstructured notes
            // If it matches [Loan] Person: Note format (from virtual entries)
            if (note.startsWith("[Loan] ") || note.startsWith("[Payment] ")) {
                const parts = note.split(":");
                title = parts[0].trim(); // "[Loan] Name" or "[Payment] Name" initially

                // Try to extract strict name if pattern matches
                const nameMatch = note.match(/^\[(Loan|Payment)\] (.*?):/);
                if (nameMatch) {
                    title = nameMatch[2].trim();
                    itemName = note.replace(nameMatch[0], "").trim();
                }

                if (!itemName) itemName = note.startsWith("[Payment]") ? "Loan Repayment" : "Loan Given";

                // If title still has the [Prefix], clean it up slightly if needed, but the regex above handles most.
                // Fallback if regex didn't match (e.g. no colon)
                if (title.startsWith("[")) {
                    const endBracket = title.indexOf("]");
                    if (endBracket !== -1) {
                        title = title.substring(endBracket + 1).trim();
                    }
                }
            }
            else if (note.startsWith("[Bill] ")) {
                title = note.replace("[Bill] ", "").trim();
                itemName = "Utility Bill";
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
            isStructured
        };
    };

    const isVirtualEntry = (id: string | number): boolean => {
        const idStr = String(id);
        return idStr.startsWith('debt_') || idStr.startsWith('pay_') || idStr.startsWith('util_');
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
                const { itemName } = parseTransactionNote(row.note);
                return <span className="text-gray-900 font-medium">{itemName}</span>;
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
                return (
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
        <Table
            data={data}
            columns={columns}
            emptyMessage="No ledger entries found."
        />
    );
}
