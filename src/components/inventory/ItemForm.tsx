"use client";

import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { useRouter } from "next/navigation";
import { Category, Unit, Item } from "@/types/inventory";
import CategoryManager from "./CategoryManager";

interface ItemFormProps {
    initialData?: Item;
    isEditing?: boolean;
}

export function ItemForm({ initialData, isEditing = false }: ItemFormProps) {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);

    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        categoryId: initialData?.categoryId || "",
        baseUnitId: initialData?.baseUnitId || "",
        saleUnitId: initialData?.saleUnitId || "",
        firstSalePrice: initialData?.firstSalePrice ?? 0,
        secondPurchasePrice: initialData?.secondPurchasePrice ?? 0,
        conversionFactor: initialData?.conversionFactor || 1,
        minStockLevel: initialData?.minStockLevel || 0,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        const [catRes, unitRes] = await Promise.all([
            fetch("/api/categories"),
            fetch("/api/units"),
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (unitRes.ok) setUnits(await unitRes.json());
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [showCategoryManager, setShowCategoryManager] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numericFields = ['conversionFactor', 'minStockLevel', 'firstSalePrice', 'secondPurchasePrice'];
        setFormData((prev) => ({
            ...prev,
            [name]: numericFields.includes(name) ? (value === '' ? '' : Number(value)) : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const url = isEditing && initialData ? `/api/items/${initialData.id}` : "/api/items";
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save item");
            }

            router.push("/items");
            router.refresh(); // Refresh server components if any
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
                {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700">Item Name</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Category</label>
                        <button
                            type="button"
                            onClick={() => setShowCategoryManager(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            + Manage Categories
                        </button>
                    </div>

                    <select
                        name="categoryId"
                        value={formData.categoryId}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                    >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Base Unit</label>
                        <select
                            name="baseUnitId"
                            value={formData.baseUnitId}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                        >
                            <option value="">Select Unit</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.symbol})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Sale Unit</label>
                        <select
                            name="saleUnitId"
                            value={formData.saleUnitId}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                        >
                            <option value="">Select Unit</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.symbol})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Sale Price</label>
                        <input
                            type="number"
                            step="0.01"
                            name="firstSalePrice"
                            value={String(formData.firstSalePrice)}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Purchase Price</label>
                        <input
                            type="number"
                            step="0.01"
                            name="secondPurchasePrice"
                            value={String(formData.secondPurchasePrice)}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Conversion Factor</label>
                    <p className="text-xs text-gray-500">1 Sale Unit = X Base Units</p>
                    <input
                        type="number"
                        step="any"
                        name="conversionFactor"
                        value={String(formData.conversionFactor)}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Minimum Stock Level (Base Unit)</label>
                    <input
                        type="number"
                        step="any"
                        name="minStockLevel"
                        value={String(formData.minStockLevel)}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                    />
                </div>

                <div className="flex justify-end space-x-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : isEditing ? "Update Item" : "Create Item"}
                    </Button>
                </div>
            </form>

            {showCategoryManager && (
                <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <CategoryManager
                            onClose={() => setShowCategoryManager(false)}
                            onChange={() => fetchData()}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
