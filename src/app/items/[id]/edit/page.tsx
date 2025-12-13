"use client";

import React, { useEffect, useState, use } from "react";
import { ItemForm } from "@/components/inventory/ItemForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { Item } from "@/types/inventory";
import { DashboardLayout } from "@/components/layout";

export default function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchItem = async () => {
            try {
                const res = await fetch(`/api/items/${id}`);
                if (!res.ok) throw new Error("Failed to fetch item");
                const data = await res.json();
                setItem(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "An error occurred");
            } finally {
                setLoading(false);
            }
        };
        fetchItem();
    }, [id]);

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto space-y-6">
                {loading ? (
                    <LoadingSpinner />
                ) : error ? (
                    <ErrorDisplay message={error} />
                ) : !item ? (
                    <div className="text-center py-12 text-gray-500">Item not found</div>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-gray-900">Edit: {item.name}</h1>
                        <ItemForm initialData={item} isEditing />
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
