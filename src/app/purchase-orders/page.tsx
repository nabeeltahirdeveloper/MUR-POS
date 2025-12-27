"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";

interface PurchaseOrder {
    id: string;
    supplier?: { id: string; name: string } | null;
    status: "draft" | "pending" | "approved" | "received" | "cancelled";
    totalAmount?: number | null;
    createdAt: string | Date;
}

interface Supplier {
    id: string;
    name: string;
}

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    const [page, setPage] = useState(1);
    const limit = 10;
    const [totalPages, setTotalPages] = useState(1);

    const [status, setStatus] = useState<string>("");
    const [supplierId, setSupplierId] = useState<string>("");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [search, setSearch] = useState<string>("");

    useEffect(() => {
        fetch("/api/suppliers?limit=500")
            .then((res) => res.json())
            .then((data) => setSuppliers(data.suppliers || []))
            .catch(() => setSuppliers([]));
    }, []);

    const fetchPOs = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", String(limit));
            if (status) params.set("status", status);
            if (supplierId) params.set("supplierId", supplierId);
            if (startDate) params.set("startDate", startDate);
            if (endDate) params.set("endDate", endDate);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/purchase-orders?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to fetch purchase orders");
            setOrders(data.purchaseOrders || []);
            setTotalPages(data.pagination?.pages || 1);
        } catch (e: any) {
            setError(e.message || "Failed to fetch purchase orders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPOs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    // Debounce filter changes (reset to page 1)
    useEffect(() => {
        const t = setTimeout(() => {
            if (page !== 1) {
                setPage(1);
            } else {
                fetchPOs();
            }
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, supplierId, startDate, endDate, search]);

    const columns = [
        {
            key: "id",
            header: "PO #",
            render: (value: any) => (
                <div className="max-w-[10rem] truncate font-mono" title={String(value || "")}>
                    {String(value || "—")}
                </div>
            ),
        },
        {
            key: "supplier",
            header: "Supplier",
            render: (_: any, row: PurchaseOrder) => (
                <div className="max-w-[18rem] truncate" title={row.supplier?.name || ""}>
                    {row.supplier?.name || "—"}
                </div>
            ),
        },
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
            render: (value: any) =>
                new Intl.NumberFormat("en-PK", {
                    style: "currency",
                    currency: "PKR",
                    maximumFractionDigits: 2,
                }).format(Number(value || 0))
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
        <div className="space-y-6 min-w-0">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                <Link
                    href="/purchase-orders/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    Create Purchase Order
                </Link>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                    <input
                        className="sm:col-span-2 lg:col-span-4 min-w-0 w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Search by supplier name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="lg:col-span-2 min-w-0 w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                        className="lg:col-span-3 min-w-0 w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                    >
                        <option value="">All Suppliers</option>
                        {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                    <div className="lg:col-span-3 grid grid-cols-2 gap-2 min-w-0">
                        <input
                            type="date"
                            className="min-w-0 w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <input
                            type="date"
                            className="min-w-0 w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
                            Prev
                        </Button>
                        <Button variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            {error && <div className="mb-6"><ErrorDisplay message={error} onRetry={() => fetchPOs()} /></div>}

            {loading ? (
                <div className="text-center py-10">Loading purchase orders...</div>
            ) : (
                <div className="min-w-0">
                    <Table data={orders} columns={columns} emptyMessage="No purchase orders found." />
                </div>
            )}
        </div>
    );
}
