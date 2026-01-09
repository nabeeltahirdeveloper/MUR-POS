"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAlert } from "@/contexts/AlertContext";

interface Supplier {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
}

export default function EditSupplierPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { showConfirm, showAlert } = useAlert();

    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({ name: "", phone: "", address: "" });

    useEffect(() => {
        const fetchSupplier = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/suppliers/${id}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Failed to load supplier");
                setSupplier(data);
                setForm({
                    name: data.name || "",
                    phone: data.phone || "",
                    address: data.address || "",
                });
            } catch (e: any) {
                setError(e.message || "Failed to load supplier");
            } finally {
                setLoading(false);
            }
        };

        fetchSupplier();
    }, [id]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/suppliers/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    phone: form.phone.trim() || null,
                    address: form.address.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to update supplier");
            setSupplier(data);
            await showAlert("Supplier updated", { variant: "success" });
        } catch (e: any) {
            setError(e.message || "Failed to update supplier");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!supplier) return;
        const ok = await showConfirm(`Delete supplier "${supplier.name}"?`, { variant: "danger" });
        if (!ok) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to delete supplier");
            router.push("/suppliers");
        } catch (e: any) {
            setError(e.message || "Failed to delete supplier");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/suppliers" className="text-gray-500 hover:text-gray-700">
                        &larr; Back
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Edit Supplier</h1>
                </div>
                <Button variant="danger" onClick={handleDelete} isLoading={saving} disabled={!supplier}>
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


