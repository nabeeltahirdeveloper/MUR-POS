import React from "react";
import { Table } from "../ui/Table";
import { StockLog } from "@/types/inventory";

interface StockLogTableProps {
    logs: StockLog[];
}

export function StockLogTable({ logs }: StockLogTableProps) {
    return (
        <Table<StockLog>
            data={logs}
            columns={[
                {
                    key: "createdAt",
                    header: "Date",
                    render: (value) => new Date(value as string).toLocaleString(),
                },
                {
                    key: "type",
                    header: "Type",
                    render: (value) => (
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${value === "in"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                        >
                            {value === "in" ? "IN" : "OUT"}
                        </span>
                    ),
                },
                {
                    key: "quantityBaseUnit",
                    header: "Quantity",
                    render: (value, row) => (
                        <span className={row.type === 'in' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {row.type === 'in' ? '+' : '-'}{String(value)} {row.item?.baseUnit?.symbol}
                        </span>
                    ),
                },
                {
                    key: "description",
                    header: "Description",
                },
            ]}
            emptyMessage="No stock logs found."
        />
    );
}
