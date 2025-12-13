"use client";

import React from "react";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";

type LedgerEntry = {
    id: number;
    type: "debit" | "credit";
    amount: number | string;
    category: { name: string } | null;
    note: string | null;
    date: string; // ISO string
};

interface LedgerTableProps {
    data: LedgerEntry[];
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
    loading?: boolean;
}

export default function LedgerTable({
    data,
    onEdit,
    onDelete,
    loading,
}: LedgerTableProps) {
    const columns = [
        {
            key: "date",
            header: "Date",
            render: (value: any) => new Date(value).toLocaleDateString(),
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
                    {value === "credit" ? "Credit (In)" : "Debit (Out)"}
                </span>
            ),
        },
        {
            key: "category.name",
            header: "Category",
            render: (value: any) => value || "Uncategorized",
        },
        {
            key: "note",
            header: "Note",
            render: (value: any) => (
                <span className="truncate max-w-xs block" title={value}>
                    {value || "-"}
                </span>
            ),
        },
        {
            key: "amount",
            header: "Amount",
            render: (value: any, row: LedgerEntry) => (
                <span className={`font-mono font-medium ${row.type === "credit" ? "text-green-600" : "text-red-600"
                    }`}>
                    {Number(value).toFixed(2)}
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
