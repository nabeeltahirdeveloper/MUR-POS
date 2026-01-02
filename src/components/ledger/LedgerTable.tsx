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

    // Helper to parse existing notes based on the standardized format
    const parseTransactionNote = (note: string | null) => {
        if (!note) return { orderNumber: "-", customerName: "-", itemName: "-", quantity: null, unitPrice: null, isStructured: false };

        const lines = note.split('\n');
        let orderNumber = "";
        let customerName = "";
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
                customerName = line.replace("Customer: ", "").trim();
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
            return { orderNumber: "-", customerName: "-", itemName: note, quantity: null, unitPrice: null, isStructured: false };
        }

        return {
            orderNumber: orderNumber || "-",
            customerName: customerName || "-",
            itemName: itemName || "-",
            quantity,
            unitPrice,
            isStructured
        };
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
            key: "customer",
            header: "Customer",
            render: (_: any, row: LedgerEntry) => {
                const { customerName } = parseTransactionNote(row.note);
                return <span className="text-gray-900 font-medium">{customerName}</span>;
            },
        },
        {
            key: "item",
            header: "Item",
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
                return <span className="text-gray-600 text-right block">{unitPrice ? `Rs. ${Number(unitPrice).toLocaleString()}` : "-"}</span>;
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
                    {value === "credit" ? "Credit" : "Debit"}
                </span>
            ),
        },
        {
            key: "amount",
            header: "Amount",
            render: (value: any, row: LedgerEntry) => (
                <span className={`font-mono font-bold ${row.type === "credit" ? "text-green-600" : "text-red-600"
                    }`}>
                    Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            ),
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
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
