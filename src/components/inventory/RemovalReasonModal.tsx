import React, { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface RemovalReasonModalProps {
    isOpen: boolean;
    quantity: number;
    unitLabel: string;
    itemName: string;
    onConfirm: (reason: string, notes: string) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

const REMOVAL_REASONS = [
    { id: "damaged", label: "Damaged", color: "red" },
    { id: "defective", label: "Defective", color: "orange" },
    { id: "lost", label: "Lost/Missing", color: "yellow" },
    { id: "waste", label: "Waste/Expired", color: "purple" },
    { id: "other", label: "Other", color: "gray" },
];

export function RemovalReasonModal({
    isOpen,
    quantity,
    unitLabel,
    itemName,
    onConfirm,
    onCancel,
    isLoading = false,
}: RemovalReasonModalProps) {
    const [selectedReason, setSelectedReason] = useState<string>("damaged");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            await onConfirm(selectedReason, notes);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Remove Items</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Removing {quantity} {unitLabel ? `${unitLabel} of ` : ""}<strong>{itemName}</strong>
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={submitting || isLoading}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Reason Selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                        Why are you removing these items?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {REMOVAL_REASONS.map((reason) => (
                            <button
                                key={reason.id}
                                onClick={() => setSelectedReason(reason.id)}
                                disabled={submitting || isLoading}
                                className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                                    selectedReason === reason.id
                                        ? `border-${reason.color}-500 bg-${reason.color}-50 text-${reason.color}-900`
                                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                }`}
                            >
                                {reason.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                        Additional Notes (Optional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={submitting || isLoading}
                        placeholder="e.g., Item damaged during transport, liquid leakage detected..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                        onClick={onCancel}
                        disabled={submitting || isLoading}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={submitting || isLoading}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting || isLoading ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                                <span>Removing...</span>
                            </>
                        ) : (
                            "Confirm Removal"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
