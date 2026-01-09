"use client";

import { useEffect, useState } from "react";
import { ExclamationTriangleIcon, InformationCircleIcon, CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface AlertModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    variant?: "info" | "danger" | "success" | "warning";
    type: "alert" | "confirm";
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function AlertModal({
    isOpen,
    title,
    message,
    variant = "info",
    type,
    confirmText = "OK",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
}: AlertModalProps) {
    const [show, setShow] = useState(isOpen);

    useEffect(() => {
        setShow(isOpen);
    }, [isOpen]);

    if (!show) return null;

    // Icon and Color mapping
    const theme = {
        info: {
            icon: InformationCircleIcon,
            color: "text-blue-600",
            bg: "bg-blue-100",
            button: "bg-blue-600 hover:bg-blue-700",
            border: "border-blue-200"
        },
        warning: {
            icon: ExclamationTriangleIcon,
            color: "text-amber-600",
            bg: "bg-amber-100",
            button: "bg-amber-600 hover:bg-amber-700",
            border: "border-amber-200"
        },
        danger: {
            icon: ExclamationTriangleIcon,
            color: "text-red-600",
            bg: "bg-red-100",
            button: "bg-red-600 hover:bg-red-700",
            border: "border-red-200"
        },
        success: {
            icon: CheckCircleIcon,
            color: "text-green-600",
            bg: "bg-green-100",
            button: "bg-green-600 hover:bg-green-700",
            border: "border-green-200"
        },
    };

    const currentTheme = theme[variant];
    const Icon = currentTheme.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={onCancel}
            />

            {/* Modal Panel */}
            <div className="relative w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="absolute top-4 right-4">
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex flex-col items-center text-center sm:items-start sm:text-left sm:flex-row gap-4">
                    <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${currentTheme.bg} sm:mx-0 sm:h-10 sm:w-10`}>
                        <Icon className={`h-6 w-6 ${currentTheme.color}`} aria-hidden="true" />
                    </div>
                    <div className="mt-2 sm:mt-0 flex-1">
                        <h3 className="text-lg font-bold text-gray-900 leading-6">
                            {title}
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    {type === "confirm" && (
                        <button
                            type="button"
                            className="inline-flex w-full justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                            onClick={onCancel}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        className={`inline-flex w-full justify-center rounded-xl px-3 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto ${currentTheme.button}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
