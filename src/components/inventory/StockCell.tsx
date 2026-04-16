import React, { useState } from "react";
import { Item } from "@/types/inventory";
import {
    PlusIcon,
    MinusIcon,
    CheckIcon,
    XMarkIcon,
    PencilIcon
} from "@heroicons/react/24/outline";
import { RemovalReasonModal } from "./RemovalReasonModal";
import { useAlert } from "@/contexts/AlertContext";

interface StockCellProps {
    item: Item;
    onUpdate: () => void;
}

export function StockCell({ item, onUpdate }: StockCellProps) {
    const { showAlert } = useAlert();
    const [isEditing, setIsEditing] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);
    const [adjType, setAdjType] = useState<"add" | "remove">("add");
    const [quantity, setQuantity] = useState("0");
    const [loading, setLoading] = useState(false);
    const [showRemovalModal, setShowRemovalModal] = useState(false);

    const handleSave = async () => {
        const qty = parseFloat(quantity);

        if (isNaN(qty) || qty <= 0) {
            showAlert("Please enter a valid quantity greater than 0", { variant: "danger" });
            return;
        }

        // For removal, show modal to get reason
        if (adjType === "remove") {
            setIsEditing(false);
            setIsSelecting(false);
            setShowRemovalModal(true);
            return;
        }

        // For add, proceed directly
        setLoading(true);
        try {
            const payload = {
                itemId: item.id,
                quantity: qty,
                description: `Manual add from table`,
            };

            const res = await fetch("/api/stock/add", {
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
            setIsSelecting(false);
            setQuantity("0");
        } catch (error: any) {
            console.error("Failed to update stock:", error);
            showAlert(error.message || "Failed to update stock", { variant: "danger" });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveWithReason = async (reason: string, notes: string) => {
        const qty = parseFloat(quantity);

        setLoading(true);
        try {
            const payload = {
                itemId: item.id,
                quantity: qty,
                reason: reason,
                notes: notes,
            };

            const res = await fetch("/api/stock/damage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to remove stock");
            }

            onUpdate();
            setIsEditing(false);
            setIsSelecting(false);
            setQuantity("0");
            setShowRemovalModal(false);
        } catch (error: any) {
            console.error("Failed to remove stock:", error);
            showAlert(error.message || "Failed to remove stock", { variant: "danger" });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setIsSelecting(false);
        setQuantity("0");
    };

    const unitLabel = item.baseUnit?.symbol || item.baseUnit?.name || "";

    return (
        <>
            <div className="flex items-center min-w-[150px]">
                {isEditing ? (
                    <div className={`flex items-center space-x-1 p-0.5 rounded border shadow-sm ${adjType === 'add' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center bg-white border border-gray-200 rounded focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden h-7">
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-12 text-xs p-1 outline-none font-bold text-gray-900"
                                autoFocus
                                placeholder="0"
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                            {unitLabel && (
                                <span className="text-[10px] text-gray-400 font-bold px-1.5 border-l border-gray-100 bg-gray-50 h-full flex items-center">
                                    {unitLabel}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className={`${adjType === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded transition-colors h-7 w-7 flex items-center justify-center`}
                        >
                            {loading ? <div className="h-3 w-3 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <CheckIcon className="h-4 w-4 stroke-[3px]" />}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={loading}
                            className="text-gray-400 hover:text-gray-600 h-7 w-7 flex items-center justify-center"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                ) : isSelecting ? (
                    <div className="flex items-center space-x-1.5 bg-white p-1 rounded-md border border-gray-200 shadow-sm transition-all duration-200 animate-in fade-in zoom-in-95">
                        <button
                            onClick={() => {
                                setAdjType("add");
                                setIsEditing(true);
                            }}
                            className="flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-600 hover:text-white h-7 w-7 rounded border border-green-200 transition-all font-bold"
                            title="Add Stock"
                        >
                            <PlusIcon className="h-4 w-4 stroke-[3px]" />
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-0.5" />
                        <button
                            onClick={() => setIsSelecting(false)}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                            title="Cancel"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center space-x-3 group min-h-[1.75rem]">
                        <div className="flex items-baseline space-x-1">
                            <span className="font-bold text-gray-900 text-sm">{String(item.currentStock)}</span>
                            {unitLabel && (
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{unitLabel}</span>
                            )}
                        </div>

                        <button
                            onClick={() => setIsSelecting(true)}
                            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded-md transition-all transform hover:scale-110"
                            title="Adjust Stock"
                        >
                            <PencilIcon className="h-4 w-4" />
                        </button>

                        {item.isLowStock && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-red-50 text-red-600 border border-red-200 uppercase tracking-tighter">
                                LOW
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Removal Reason Modal */}
            <RemovalReasonModal
                isOpen={showRemovalModal}
                quantity={parseFloat(quantity) || 0}
                unitLabel={unitLabel}
                itemName={item.name}
                isLoading={loading}
                onConfirm={handleRemoveWithReason}
                onCancel={() => {
                    setShowRemovalModal(false);
                    setQuantity("0");
                }}
            />
        </>
    );
}
