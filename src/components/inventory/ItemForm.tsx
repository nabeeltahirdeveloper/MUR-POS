"use client";

import React, { useEffect, useState, useRef } from "react";
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

    // Supplier Search State
    const [suppliers, setSuppliers] = useState<{ id: string; name: string; phone?: string; address?: string }[]>([]);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState(initialData?.supplier?.name || "");
    const [isSearchingSupplier, setIsSearchingSupplier] = useState(false);
    const [showSupplierResults, setShowSupplierResults] = useState(false);
    const [isNewSupplier, setIsNewSupplier] = useState(false);
    const [newSupplierData, setNewSupplierData] = useState({ phone: "", address: "" });
    const supplierSearchRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        categoryId: initialData?.categoryId || "",
        baseUnitId: initialData?.baseUnitId || "",
        saleUnitId: initialData?.saleUnitId || "",
        supplierId: initialData?.supplierId || "",
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
        const handleClickOutside = (event: MouseEvent) => {
            if (supplierSearchRef.current && !supplierSearchRef.current.contains(event.target as Node)) {
                setShowSupplierResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (supplierSearchTerm.length >= 1 && showSupplierResults && !isNewSupplier) {
                setIsSearchingSupplier(true);
                try {
                    const res = await fetch(`/api/suppliers?search=${encodeURIComponent(supplierSearchTerm)}&limit=10`);
                    if (res.ok) {
                        const data = await res.json();
                        setSuppliers(data.suppliers || []);
                    }
                } catch (err) {
                    console.error("Failed to search suppliers", err);
                } finally {
                    setIsSearchingSupplier(false);
                }
            } else if (supplierSearchTerm.length === 0) {
                setSuppliers([]);
                setShowSupplierResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [supplierSearchTerm, showSupplierResults, isNewSupplier]);

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
            let finalSupplierId = formData.supplierId;

            // Handle New Supplier Creation
            if (isNewSupplier && supplierSearchTerm) {
                const supplierRes = await fetch("/api/suppliers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: supplierSearchTerm,
                        phone: newSupplierData.phone,
                        address: newSupplierData.address,
                    }),
                });
                if (!supplierRes.ok) {
                    const d = await supplierRes.json();
                    throw new Error(d.error || "Failed to create supplier");
                }
                const newSupplier = await supplierRes.json();
                finalSupplierId = newSupplier.id;
            }

            const url = isEditing && initialData ? `/api/items/${initialData.id}` : "/api/items";
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    supplierId: finalSupplierId,
                }),
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

                <div className="relative" ref={supplierSearchRef}>
                    <label className="block text-sm font-medium text-gray-700">Supplier</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={supplierSearchTerm}
                            onChange={(e) => {
                                setSupplierSearchTerm(e.target.value);
                                if (!isNewSupplier) setShowSupplierResults(true);
                                if (formData.supplierId) setFormData(prev => ({ ...prev, supplierId: "" }));
                            }}
                            onFocus={() => { if (supplierSearchTerm.length >= 1 && !isNewSupplier) setShowSupplierResults(true); }}
                            placeholder="Search Supplier..."
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                        />
                        {isSearchingSupplier && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </span>
                        )}
                        {isNewSupplier && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNewSupplier(false);
                                    setSupplierSearchTerm("");
                                    setNewSupplierData({ phone: "", address: "" });
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {showSupplierResults && (
                        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                            {isSearchingSupplier ? (
                                <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                            ) : suppliers.length > 0 ? (
                                <ul>
                                    {suppliers.map((s) => (
                                        <li
                                            key={s.id}
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, supplierId: s.id }));
                                                setSupplierSearchTerm(s.name);
                                                setShowSupplierResults(false);
                                            }}
                                            className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-900 flex justify-between items-center"
                                        >
                                            <span>{s.name}</span>
                                            {s.phone && <span className="text-xs text-gray-500">{s.phone}</span>}
                                        </li>
                                    ))}
                                </ul>
                            ) : supplierSearchTerm.length > 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    <p>No supplier found</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsNewSupplier(true);
                                            setShowSupplierResults(false);
                                        }}
                                        className="mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        + Create New Supplier
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {isNewSupplier && (
                        <div className="mt-3 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">Phone Number</label>
                                <input
                                    type="text"
                                    value={newSupplierData.phone}
                                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="Enter phone..."
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">Address</label>
                                <input
                                    type="text"
                                    value={newSupplierData.address}
                                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="Enter address..."
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                                />
                            </div>
                        </div>
                    )}
                </div>

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
