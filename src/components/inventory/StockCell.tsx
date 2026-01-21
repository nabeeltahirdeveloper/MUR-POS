import React, { useState } from "react";
import { Item } from "@/types/inventory";
import {
    PencilIcon,
    CheckIcon,
    XMarkIcon
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";

interface StockCellProps {
    item: Item;
    onUpdate: () => void;
}

export function StockCell({ item, onUpdate }: StockCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(String(item.currentStock));
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        const newStock = parseFloat(value);
        const currentStock = item.currentStock || 0;
        const diff = newStock - currentStock;

        if (diff === 0) {
            setIsEditing(false);
            return;
        }

        setLoading(true);
        try {
            const endpoint = diff > 0 ? "/api/stock/add" : "/api/stock/remove";
            const payload = {
                itemId: item.id,
                quantity: Math.abs(diff),
                description: "Manual adjustment from table",
            };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update stock");
            }

            onUpdate();
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update stock:", error);
            alert("Failed to update stock");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setValue(String(item.currentStock));
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center space-x-2">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1 border"
                    autoFocus
                    step="any"
                />
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="text-green-600 hover:text-green-900 p-1"
                >
                    <CheckIcon className="h-5 w-5" />
                </button>
                <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="text-red-600 hover:text-red-900 p-1"
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-2">
            <span>{String(item.currentStock)} {item.baseUnit?.symbol || item.baseUnit?.name}</span>
            {item.isLowStock && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Low
                </span>
            )}
            <button
                onClick={() => {
                    setValue(String(item.currentStock));
                    setIsEditing(true);
                }}
                className="text-gray-400 hover:text-blue-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit Stock"
            >
                <PencilIcon className="h-4 w-4" />
            </button>
        </div>
    );
}
