"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AlertModal } from "@/components/ui/AlertModal";

interface AlertOptions {
    title?: string;
    message: string;
    variant?: "info" | "danger" | "success" | "warning";
    confirmText?: string;
    cancelText?: string;
}

interface AlertContextType {
    showAlert: (message: string, options?: Omit<AlertOptions, "message">) => Promise<void>;
    showConfirm: (message: string, options?: Omit<AlertOptions, "message">) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error("useAlert must be used within an AlertProvider");
    }
    return context;
}

export function AlertProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<AlertOptions & { type: "alert" | "confirm" }>({
        message: "",
        type: "alert",
    });

    // We store the resolve function for the current active promise
    const [resolver, setResolver] = useState<(value: any) => void>(() => { });

    const showAlert = useCallback((message: string, options?: Omit<AlertOptions, "message">) => {
        return new Promise<void>((resolve) => {
            setConfig({
                message,
                type: "alert",
                variant: "info",
                title: "Alert",
                confirmText: "OK",
                ...options,
            });
            setResolver(() => (val: any) => resolve(val));
            setIsOpen(true);
        });
    }, []);

    const showConfirm = useCallback((message: string, options?: Omit<AlertOptions, "message">) => {
        return new Promise<boolean>((resolve) => {
            setConfig({
                message,
                type: "confirm",
                variant: "warning", // Default for confirms usually implies caution
                title: "Confirm Action",
                confirmText: "Confirm",
                cancelText: "Cancel",
                ...options,
            });
            setResolver(() => (val: boolean) => resolve(val));
            setIsOpen(true);
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        resolver(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        if (config.type === "confirm") {
            resolver(false);
        } else {
            resolver(true); // For alert, closing is same as confirming
        }
    };

    return (
        <AlertContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            <AlertModal
                isOpen={isOpen}
                title={config.title}
                message={config.message}
                variant={config.variant}
                type={config.type}
                confirmText={config.confirmText}
                cancelText={config.cancelText}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </AlertContext.Provider>
    );
}
