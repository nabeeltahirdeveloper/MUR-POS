"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Supplier {
    id: number;
    name: string;
}

export default function CreatePurchaseOrderPage() {
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        supplierId: "",
        notes: "",
        terms: ""
    });

    useEffect(() => {
        fetch("/api/suppliers?limit=100") // get list
            .then(res => res.json())
            .then(data => setSuppliers(data.suppliers))
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.supplierId) return;

        setLoading(true);
        try {
            const res = await fetch("/api/purchase-orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error("Failed to create PO");

            const po = await res.json();
            router.push(`/purchase-orders/${po.id}`);
        } catch (err) {
            console.error(err);
            alert("Failed to create purchase order");
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/purchase-orders" className="text-gray-500 hover:text-gray-700">
                    &larr; Back
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Create Purchase Order</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Supplier
                    </label>
                    <select
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={formData.supplierId}
                        onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                        required
                    >
                        <option value="">Select a supplier...</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Don't see your supplier? Create them in the Suppliers section first.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (Optional)
                    </label>
                    <textarea
                        className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Internal reference or notes..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Terms (Optional)
                    </label>
                    <textarea
                        className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        value={formData.terms}
                        onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                        placeholder="Payment terms, delivery instructions..."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Link href="/purchase-orders" className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={loading || !formData.supplierId}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                    >
                        {loading ? <div className="flex items-center gap-2"><LoadingSpinner size="sm" /> Creating...</div> : "Create Draft PO"}
                    </button>
                </div>
            </form>
        </div>
    );
}
