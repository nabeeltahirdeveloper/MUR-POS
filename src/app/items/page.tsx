"use client";

import React, { useEffect, useState } from "react";
import { ItemTable } from "@/components/inventory/ItemTable";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Item } from "@/types/inventory";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { DashboardLayout } from "@/components/layout";
import { PlusIcon } from "@heroicons/react/24/outline";

export default function ItemsPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/items");
            if (!res.ok) throw new Error("Failed to fetch items");
            const data = await res.json();
            setItems(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            const res = await fetch(`/api/items/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Failed to delete item");
                return;
            }

            fetchItems();
        } catch (err) {
            alert("An error occurred while deleting");
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
                        <p className="text-gray-500 text-sm">
                            Manage your inventory items and stock levels.
                        </p>
                    </div>
                    <Link href="/items/new">
                        <Button>
                            <PlusIcon className="h-5 w-5 mr-2" />
                            Add Item
                        </Button>
                    </Link>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <ErrorDisplay message={error} onRetry={fetchItems} />
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <ItemTable items={items} onDelete={handleDelete} />
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
