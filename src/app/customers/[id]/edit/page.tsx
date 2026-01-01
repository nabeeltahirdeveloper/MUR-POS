"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";

interface Customer {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
}

export default function EditCustomerPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({ name: "", phone: "", address: "" });

    useEffect(() => {
        const fetchCustomer = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/customers/${id}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Failed to load customer");
                setCustomer(data);
                setForm({
                    name: data.name || "",
                    phone: data.phone || "",
                    address: data.address || "",
                });
            } catch (e: any) {
                setError(e.message || "Failed to load customer");
            } finally {
                setLoading(false);
            }
        };

        fetchCustomer();
    }, [id]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    phone: form.phone.trim() || null,
                    address: form.address.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to update customer");
            setCustomer(data);
            alert("Customer updated");
        } catch (e: any) {
            setError(e.message || "Failed to update customer");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!customer) return;
        const ok = confirm(`Delete customer "${customer.name}"?`);
        if (!ok) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to delete customer");
            router.push("/customers");
        } catch (e: any) {
            setError(e.message || "Failed to delete customer");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/customers" className="text-gray-500 hover:text-gray-700">
                        &larr; Back
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Edit Customer</h1>
                </div>
                <Button variant="danger" onClick={handleDelete} isLoading={saving} disabled={!customer}>
                    Delete
                </Button>
            </div>

            {error && <ErrorDisplay message={error} />}

            <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Optional"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                        className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        value={form.address}
                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder="Optional"
                    />
                </div>
                <div className="flex justify-end">
                    <Button type="submit" isLoading={saving}>
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    );
}
