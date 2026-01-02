"use client";

import React, { useEffect, useState, use } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { Button } from "@/components/ui/Button";
import { StockLogTable } from "@/components/inventory/StockLogTable";
import { Item, StockLog } from "@/types/inventory";
import { DashboardLayout } from "@/components/layout";
import {
    PlusIcon,
    MinusIcon,
    ClockIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export default function ItemStockPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [item, setItem] = useState<Item | null>(null);
    const [logs, setLogs] = useState<StockLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<"add" | "remove" | "logs">("logs");

    // Form states
    const [quantity, setQuantity] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [itemRes, logsRes] = await Promise.all([
                fetch(`/api/items/${id}`),
                fetch(`/api/stock/logs?itemId=${id}`),
            ]);

            if (!itemRes.ok) throw new Error("Failed to fetch item");
            if (!logsRes.ok) throw new Error("Failed to fetch logs");

            setItem(await itemRes.json());
            setLogs(await logsRes.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleStockInfoUpdate = async (type: "add" | "remove") => {
        setSubmitting(true);
        setFormError(null);
        setSuccessMessage(null);

        try {
            const res = await fetch(`/api/stock/${type}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itemId: id,
                    quantity: quantity,
                    description: description,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to update stock");
            }

            setSuccessMessage(data.message);
            setQuantity("");
            setDescription("");

            fetchData();

            setTimeout(() => {
                setActiveTab("logs");
                setSuccessMessage(null);
            }, 1500);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failure");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout>
            {loading ? (
                <LoadingSpinner />
            ) : error ? (
                <ErrorDisplay message={error} />
            ) : !item ? (
                <div className="text-center py-12 text-gray-500">Item not found</div>
            ) : (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
                                <p className="text-sm text-gray-500">
                                    {item.category?.name || "Uncategorized"}
                                </p>
                            </div>

                            {item.isLowStock && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg border border-red-200">
                                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Low Stock Alert</p>
                                        <p className="text-xs text-red-600">
                                            Below minimum level: {String(item.minStockLevel)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-sm font-medium text-blue-600">Current Stock</p>
                                <p className="text-3xl font-bold text-blue-700 mt-1">
                                    {String(item.currentStock)}{" "}
                                    <span className="text-lg font-normal">{item.baseUnit?.symbol}</span>
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm font-medium text-gray-600">Min Stock Level</p>
                                <p className="text-2xl font-bold text-gray-700 mt-1">
                                    {String(item.minStockLevel)}{" "}
                                    <span className="text-lg font-normal">{item.baseUnit?.symbol}</span>
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm font-medium text-gray-600">Total Movements</p>
                                <p className="text-2xl font-bold text-gray-700 mt-1">{logs.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="border-b border-gray-200 px-4">
                            <nav className="-mb-px flex space-x-6">
                                <button
                                    onClick={() => setActiveTab("logs")}
                                    className={`${activeTab === "logs"
                                        ? "border-blue-500 text-blue-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                        } flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    <ClockIcon className="h-5 w-5" />
                                    History
                                </button>
                                <button
                                    onClick={() => setActiveTab("add")}
                                    className={`${activeTab === "add"
                                        ? "border-green-500 text-green-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                        } flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    <PlusIcon className="h-5 w-5" />
                                    Add Stock
                                </button>
                                <button
                                    onClick={() => setActiveTab("remove")}
                                    className={`${activeTab === "remove"
                                        ? "border-red-500 text-red-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                        } flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    <MinusIcon className="h-5 w-5" />
                                    Remove Stock
                                </button>
                            </nav>
                        </div>

                        <div className="p-6">
                            {activeTab === "logs" && <StockLogTable logs={logs} />}

                            {activeTab !== "logs" && (
                                <div className="max-w-md mx-auto space-y-4">
                                    <h2 className="text-lg font-medium text-gray-900 capitalize">
                                        {activeTab === "add" ? "Add Stock" : "Remove Stock"}
                                    </h2>

                                    {formError && (
                                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                                            {formError}
                                        </div>
                                    )}
                                    {successMessage && (
                                        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                                            {successMessage}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Quantity ({item.baseUnit?.symbol})
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            className="block w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Description / Note
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={3}
                                            className="block w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900"
                                            placeholder="e.g. Received shipment #123"
                                        />
                                    </div>

                                    <Button
                                        className="w-full"
                                        onClick={() => handleStockInfoUpdate(activeTab)}
                                        disabled={submitting || !quantity}
                                        variant={activeTab === "remove" ? "danger" : "success"}
                                    >
                                        {submitting
                                            ? "Processing..."
                                            : `Confirm ${activeTab === "add" ? "Add" : "Remove"}`}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
