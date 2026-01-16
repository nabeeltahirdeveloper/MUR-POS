"use client";

import { useState, useEffect } from "react";
import { useAlert } from "@/contexts/AlertContext";

type Unit = {
    id: string;
    name: string;
    symbol?: string;
};

export default function UnitManager({
    onClose,
    onChange,
}: {
    onClose?: () => void;
    onChange?: () => void;
}) {
    const { showConfirm } = useAlert();
    const [units, setUnits] = useState<Unit[]>([]);
    const [newUnitName, setNewUnitName] = useState("");
    const [newUnitSymbol, setNewUnitSymbol] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editSymbol, setEditSymbol] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchUnits();
    }, []);

    const fetchUnits = async () => {
        try {
            const res = await fetch("/api/units");
            if (res.ok) {
                const data = await res.json();
                setUnits(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnitName.trim()) return;

        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/units", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newUnitName, symbol: newUnitSymbol }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create");
            }

            setNewUnitName("");
            setNewUnitSymbol("");
            await fetchUnits();
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
            const res = await fetch(`/api/units/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName, symbol: editSymbol }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update");
            }

            setEditingId(null);
            setEditName("");
            setEditSymbol("");
            await fetchUnits();
            if (onChange) onChange();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!await showConfirm("Are you sure? This cannot be undone.", { variant: "danger" })) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/units/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete");
            }

            await fetchUnits();
            if (onChange) onChange();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Manage Units</h3>
                    <p className="text-xs text-gray-500 mt-1">Add, edit, or remove measurement units.</p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">
                    {error}
                </div>
            )}

            <form onSubmit={handleCreate} className="flex gap-2 mb-6 items-end">
                <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Name</label>
                    <input
                        type="text"
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        placeholder="e.g. Kilogram"
                        className="w-full p-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-gray-900"
                        disabled={loading}
                    />
                </div>
                <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">Symbol</label>
                    <input
                        type="text"
                        value={newUnitSymbol}
                        onChange={(e) => setNewUnitSymbol(e.target.value)}
                        placeholder="kg"
                        className="w-full p-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-gray-900"
                        disabled={loading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !newUnitName.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer h-[42px]"
                >
                    Add
                </button>
            </form>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {units.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        No units found. Add one above.
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {units.map((unit) => (
                            <li
                                key={unit.id}
                                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
                            >
                                {editingId === unit.id ? (
                                    <div className="flex gap-2 flex-1 items-center animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex-1 space-y-1">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full p-1.5 text-sm border border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none text-gray-900"
                                                placeholder="Name"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="w-20 space-y-1">
                                            <input
                                                type="text"
                                                value={editSymbol}
                                                onChange={(e) => setEditSymbol(e.target.value)}
                                                className="w-full p-1.5 text-sm border border-blue-200 rounded focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none text-gray-900"
                                                placeholder="Sym"
                                            />
                                        </div>
                                        <div className="flex gap-1 ml-1">
                                            <button
                                                onClick={() => handleUpdate(unit.id)}
                                                className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                                                title="Save"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setEditName("");
                                                    setEditSymbol("");
                                                }}
                                                className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                                title="Cancel"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium text-gray-700 text-sm">{unit.name}</span>
                                            {unit.symbol && (
                                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full font-mono">
                                                    {unit.symbol}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditingId(unit.id);
                                                    setEditName(unit.name);
                                                    setEditSymbol(unit.symbol || "");
                                                }}
                                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(unit.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
