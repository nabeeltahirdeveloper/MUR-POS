"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Table } from "@/components/ui/Table";

interface PurchaseOrder {
    id: number;
    supplier: { name: string };
    status: string;
    totalAmount: number;
    createdAt: string;
}

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/purchase-orders")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch");
                return res.json();
            })
            .then((data) => {
                setOrders(data.purchaseOrders);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const columns = [
        { key: "id", header: "PO #" },
        { key: "supplier.name", header: "Supplier" },
        {
            key: "status",
            header: "Status",
            render: (value: any) => (
                <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${value === 'received' ? 'bg-green-100 text-green-800' :
                        value === 'cancelled' ? 'bg-red-100 text-red-800' :
                            value === 'approved' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                    }`}>
                    {value}
                </span>
            )
        },
        {
            key: "totalAmount",
            header: "Total",
            render: (value: any) => `$${Number(value).toFixed(2)}`
        },
        {
            key: "createdAt",
            header: "Date",
            render: (value: any) => new Date(value).toLocaleDateString()
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: PurchaseOrder) => (
                <Link href={`/purchase-orders/${row.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                    View
                </Link>
            )
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                <Link
                    href="/purchase-orders/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    Create Purchase Order
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-10">Loading purchase orders...</div>
            ) : (
                <Table data={orders} columns={columns} emptyMessage="No purchase orders found." />
            )}
        </div>
    );
}
