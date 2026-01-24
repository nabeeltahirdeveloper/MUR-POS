"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAlert } from "@/contexts/AlertContext";
import { SupplierTransactionDropdown } from "@/components/ledger/SupplierTransactionDropdown";

interface Supplier {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
}

interface SuppliersResponse {
    suppliers: Supplier[];
    pagination: { total: number; pages: number; page: number; limit: number };
}

export default function SuppliersPage() {
    const { showConfirm } = useAlert();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const limit = 10;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: "", phone: "", address: "" });

    const fetchSuppliers = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            params.set("page", String(page));
            params.set("limit", String(limit));

            const res = await fetch(`/api/suppliers?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch suppliers");
            const data = (await res.json()) as SuppliersResponse;
            setSuppliers(data.suppliers);
        } catch (e: any) {
            setError(e.message || "Failed to fetch suppliers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    // Debounce search (reset to page 1)
    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1);
            fetchSuppliers();
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const columns = useMemo(
        () => [
            { key: "name", header: "Name" },
            { key: "phone", header: "Phone" },
            {
                key: "address",
                header: "Address",
                render: (value: any) => (
                    <span className="max-w-[32rem] block truncate">{value || "—"}</span>
                ),
            },
            {
                key: "balance",
                header: "Net Balance",
                render: (value: any) => (
                    <span className={`font-mono font-bold ${Number(value) > 0 ? "text-red-600" : "text-green-600"}`}>
                        Rs. {Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                ),
            },
            {
                key: "actions",
                header: "Actions",
                render: (_: any, row: Supplier) => (
                    <div className="flex gap-2">
                        <Link
                            href={`/suppliers/${row.id}/edit`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Edit
                        </Link>
                        <button
                            onClick={() => handleDelete(row)}
                            className="text-red-600 hover:text-red-800 font-medium cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [suppliers]
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/suppliers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    phone: form.phone.trim() || null,
                    address: form.address.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to create supplier");
            }

            setForm({ name: "", phone: "", address: "" });
            setShowCreate(false);
            await fetchSuppliers();
        } catch (e: any) {
            setError(e.message || "Failed to create supplier");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (supplier: Supplier) => {
        const ok = await showConfirm(`Delete supplier "${supplier.name}"?`);
        if (!ok) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to delete supplier");
            }
            await fetchSuppliers();
        } catch (e: any) {
            setError(e.message || "Failed to delete supplier");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 min-w-0">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
                <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
                    {showCreate ? "Close" : "New Supplier"}
                </Button>
            </div>

            {error && <ErrorDisplay message={error} />}

            {showCreate && (
                <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                            className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-gray-900"
                            value={form.address}
                            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                            placeholder="Optional"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" isLoading={saving}>
                            Create Supplier
                        </Button>
                    </div>
                </form>
            )}

            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
                    <div className="flex-1 relative md:max-w-md">
                        <input
                            className="w-full border border-gray-300 rounded-md p-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                            placeholder="Search suppliers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {loading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-gray-500">
                        Page {page}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        <Table
                            data={suppliers}
                            columns={columns}
                            emptyMessage="No suppliers found."
                            renderSubComponent={(row) => <SupplierTransactionDropdown supplierName={row.name} />}
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <Button
                                variant="secondary"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                            >
                                Prev
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={loading || suppliers.length < limit}
                            >
                                Next
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


