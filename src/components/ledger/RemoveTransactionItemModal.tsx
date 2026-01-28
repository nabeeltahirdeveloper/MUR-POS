import React, { useState } from "react";
import { XMarkIcon, MinusIcon } from "@heroicons/react/24/outline";

interface RemoveTransactionItemModalProps {
    isOpen: boolean;
    item: {
        name: string;
        qty: string;
        rate: string;
    } | null;
    purchasePrice?: number;
    onConfirm: (quantityToRemove: number, reason: string, notes: string) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

const REMOVAL_REASONS = [
    { id: "damaged", label: "Damaged", color: "red" },
    { id: "defective", label: "Defective", color: "orange" },
    { id: "lost", label: "Lost/Missing", color: "yellow" },
    { id: "waste", label: "Waste/Expired", color: "purple" },
    { id: "error", label: "Receiving Error", color: "blue" },
    { id: "other", label: "Other", color: "gray" },
];

export function RemoveTransactionItemModal({
    isOpen,
    item,
    purchasePrice,
    onConfirm,
    onCancel,
    isLoading = false,
}: RemoveTransactionItemModalProps) {
    const [selectedReason, setSelectedReason] = useState<string>("damaged");
    const [notes, setNotes] = useState("");
    const [quantityToRemove, setQuantityToRemove] = useState<string>("1");
    const [submitting, setSubmitting] = useState(false);

    const maxQty = item?.qty ? parseFloat(item.qty.split(" ")[0]) : 0;

    const handleConfirm = async () => {
        const qty = parseFloat(quantityToRemove);

        if (isNaN(qty) || qty <= 0 || qty > maxQty) {
            alert(`Please enter a valid quantity between 1 and ${maxQty}`);
            return;
        }

        setSubmitting(true);
        try {
            await onConfirm(qty, selectedReason, notes);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full sm:max-w-md my-4 sm:my-auto p-4 sm:p-6 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 pb-4 border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                            <MinusIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
                            <span>Remove Item</span>
                        </h2>
                        <div className="mt-2 bg-blue-100 border-l-4 border-blue-600 p-2 sm:p-3 rounded">
                            <p className="text-base sm:text-lg font-bold text-blue-900 break-words line-clamp-2">
                                {item.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={submitting || isLoading}
                        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-1"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-3 sm:space-y-5 py-4 sm:py-6">
                    {/* Current Item Details */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                        <div className="flex justify-between items-center gap-2">
                            <span className="text-sm sm:text-base font-semibold text-gray-800">Ordered Qty:</span>
                            <span className="font-bold text-gray-900 text-lg sm:text-2xl bg-white px-3 py-1 rounded border-2 border-blue-300">{item.qty}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <span className="text-sm sm:text-base font-semibold text-gray-800">Unit Rate:</span>
                            <span className="font-bold text-blue-700 text-lg sm:text-2xl">Rs. {(purchasePrice || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 pt-2 border-t border-blue-200">
                            <span className="text-sm sm:text-base font-semibold text-gray-800">Total Value:</span>
                            <span className="font-bold text-blue-600 text-lg sm:text-2xl bg-yellow-100 px-3 py-1 rounded">Rs. {((parseFloat(quantityToRemove) || 0) * (purchasePrice || 0)).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Quantity to Remove */}
                    <div className="space-y-2">
                        <label className="block text-sm sm:text-base font-semibold text-gray-900">
                            How many items to remove?
                        </label>
                        <input
                            type="number"
                            value={quantityToRemove}
                            onChange={(e) => setQuantityToRemove(e.target.value)}
                            disabled={submitting || isLoading}
                            min="1"
                            max={maxQty}
                            className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-xl font-bold text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                            placeholder="1"
                        />
                        <p className="text-sm text-gray-600 font-medium">
                            Maximum: {maxQty} units
                        </p>
                    </div>

                    {/* Reason Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm sm:text-base font-semibold text-gray-900">
                            Why are you removing these items?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {REMOVAL_REASONS.map((reason) => {
                                const isSelected = selectedReason === reason.id;
                                const colors: Record<string, string> = {
                                    red: isSelected ? "bg-red-100 border-red-500 text-red-900" : "bg-white border-gray-300 text-gray-700",
                                    orange: isSelected ? "bg-orange-100 border-orange-500 text-orange-900" : "bg-white border-gray-300 text-gray-700",
                                    yellow: isSelected ? "bg-yellow-100 border-yellow-500 text-yellow-900" : "bg-white border-gray-300 text-gray-700",
                                    purple: isSelected ? "bg-purple-100 border-purple-500 text-purple-900" : "bg-white border-gray-300 text-gray-700",
                                    blue: isSelected ? "bg-blue-100 border-blue-500 text-blue-900" : "bg-white border-gray-300 text-gray-700",
                                    gray: isSelected ? "bg-gray-200 border-gray-500 text-gray-900" : "bg-white border-gray-300 text-gray-700",
                                };
                                return (
                                    <button
                                        key={reason.id}
                                        onClick={() => setSelectedReason(reason.id)}
                                        disabled={submitting || isLoading}
                                        className={`p-2 sm:p-3 rounded-lg border-2 transition-all text-sm sm:text-base font-medium ${colors[reason.color]}`}
                                    >
                                        {reason.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="block text-sm sm:text-base font-semibold text-gray-900">
                            Additional Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={submitting || isLoading}
                            placeholder="e.g., Items damaged in transit, wrong quantity received..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-gray-900"
                            rows={2}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                    <button
                        onClick={onCancel}
                        disabled={submitting || isLoading}
                        className="flex-1 px-4 py-3 text-base sm:text-sm font-medium text-gray-700 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={submitting || isLoading}
                        className="flex-1 px-4 py-3 text-base sm:text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting || isLoading ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                                <span>Removing...</span>
                            </>
                        ) : (
                            <>
                                <MinusIcon className="h-5 w-5" />
                                <span>Remove Items</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
