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
                    <Link
                        href="/suppliers"
                        className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-primary hover:border-primary transition-all shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Edit Supplier</h1>
                </div>
                <Button
                    variant="danger"
                    onClick={handleDelete}
                    isLoading={saving}
                    disabled={!supplier}
                    className="rounded-xl px-6 font-bold uppercase text-xs tracking-widest shadow-lg shadow-red-500/20"
                >
                    Delete
                </Button>
            </div>

            {error && <ErrorDisplay message={error} />}

            <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 space-y-6">
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Supplier Name</label>
                    <input
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Enter full name"
                        required
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Phone Number</label>
                    <input
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="e.g., 0300 1234567"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Address</label>
                    <textarea
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 font-bold h-32 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-300"
                        value={form.address}
                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder="Enter complete address"
                    />
                </div>
                <div className="flex justify-end pt-4">
                    <Button
                        type="submit"
                        isLoading={saving}
                        className="w-full sm:w-auto rounded-xl px-10 py-4 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary-dark text-white"
                    >
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    );
}


