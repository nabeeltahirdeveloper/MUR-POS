import React from "react";
import { Table } from "../ui/Table";
import { Item } from "@/types/inventory";
import Link from "next/link";
import { Button } from "../ui/Button";

interface ItemTableProps {
    items: Item[];
    onDelete?: (id: string) => void;
}

export function ItemTable({ items, onDelete }: ItemTableProps) {
    return (
        <Table<Item>
            data={items}
            columns={[
                {
                    key: "orderNumber",
                    header: "#",
                    render: (_value, _row, index) => (
                        <div className="text-gray-500 font-medium">{index + 1}</div>
                    ),
                },
                {
                    key: "name",
                    header: "Name",
                    render: (value, row) => (
                        <div className="font-medium text-gray-900">{row.name}</div>
                    ),
                },
                {
                    key: "supplier",
                    header: "Supplier",
                    render: (value, row) => (
                        <span className="text-gray-600">{row.supplier?.name || "—"}</span>
                    ),
                },
                {
                    key: "category.name",
                    header: "Category",
                    render: (value, row) => (
                        <span>{row.category?.name || "—"}</span>
                    ),
                },
                {
                    key: "currentStock",
                    header: "Stock",
                    render: (value, row) => (
                        <div className="flex items-center space-x-2">
                            <span>{String(row.currentStock)} {row.baseUnit?.symbol || row.baseUnit?.name}</span>
                            {row.isLowStock && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    Low Stock
                                </span>
                            )}
                        </div>
                    ),
                },
                {
                    key: "saleUnit.name",
                    header: "Sale Unit",
                    render: (value, row) => {
                        if (!row.saleUnit) return <span>—</span>;
                        return (
                            <span>
                                {row.saleUnit.name}
                                {row.saleUnit.symbol && ` (${row.saleUnit.symbol})`}
                            </span>
                        );
                    },
                },
                {
                    key: "actions",
                    header: "Actions",
                    render: (_, row) => (
                        <div className="flex space-x-2">
                            <Link href={`/items/${row.id}/stock`}>
                                <Button variant="secondary" size="sm">
                                    Stock
                                </Button>
                            </Link>
                            <Link href={`/items/${row.id}/edit`}>
                                <Button variant="outline" size="sm">
                                    Edit
                                </Button>
                            </Link>
                            {onDelete && (
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => onDelete(row.id)}
                                >
                                    Delete
                                </Button>
                            )}
                        </div>
                    ),
                },
            ]}
            emptyMessage="No items found. Create one to get started."
        />
    );
}
