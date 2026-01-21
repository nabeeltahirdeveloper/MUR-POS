import React from "react";
import { Table } from "../ui/Table";
import { Item } from "@/types/inventory";
import Link from "next/link";
import { Button } from "../ui/Button";
import { StockCell } from "./StockCell";

interface ItemTableProps {
    items: Item[];
    onDelete?: (id: string) => void;
    onUpdate?: () => void;
}

export function ItemTable({ items, onDelete, onUpdate }: ItemTableProps) {
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
                    key: "image",
                    header: "Image",
                    render: (value, row) => (
                        <div className="group relative w-10 h-10 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                            {row.image ? (
                                <img
                                    src={row.image}
                                    alt={row.name}
                                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-150"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                            )}
                        </div>
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
                    key: "description",
                    header: "Description",
                    render: (value, row) => (
                        <div className="text-sm text-gray-500 max-w-xs truncate" title={row.description || ""}>
                            {row.description || "—"}
                        </div>
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
                        <StockCell
                            item={row}
                            onUpdate={onUpdate || (() => window.location.reload())}
                        />
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
