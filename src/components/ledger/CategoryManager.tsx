"use client";

import { useState, useEffect } from "react";

type Category = {
    id: string;
    name: string;
};

export default function CategoryManager({
    onClose,
    onChange,
}: {
    onClose?: () => void;
    onChange?: () => void;
}) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/ledger/categories");
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategory.trim()) return;

        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/ledger/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newCategory }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create");
            }

            setNewCategory("");
            await fetchCategories();
            if (onChange) onChange();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/ledger/categories/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update");
            }

            setEditingId(null);
            setEditName("");
            await fetchCategories();
            if (onChange) onChange();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/ledger/categories/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete");
            }

            await fetchCategories();
            if (onChange) onChange();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Manage Categories</h3>
                {onClose && (
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">
                    {error}
                </div>
            )}

            <form onSubmit={handleCreate} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    className="flex-1 p-2 border border-gray-300 rounded focus:border-primary focus:outline-none"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !newCategory.trim()}
                    className="bg-primary text-white font-bold px-4 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
                >
                    Add
                </button>
            </form>

            <ul className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map((cat) => (
                    <li
                        key={cat.id}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 group"
                    >
                        {editingId === cat.id ? (
                            <div className="flex gap-2 flex-1">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="flex-1 p-1 border border-gray-300 rounded"
                                />
                                <button
                                    onClick={() => handleUpdate(cat.id)}
                                    className="text-green-600 hover:text-green-800 text-sm"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingId(null);
                                        setEditName("");
                                    }}
                                    className="text-gray-500 hover:text-gray-700 text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className="text-gray-700">{cat.name}</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingId(cat.id);
                                            setEditName(cat.name);
                                        }}
                                        className="text-primary hover:text-primary-dark text-sm font-bold"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
