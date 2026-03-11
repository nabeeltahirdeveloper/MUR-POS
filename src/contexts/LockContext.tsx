"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { usePathname } from "next/navigation";

interface LockContextType {
    isLocked: boolean;
    unlock: (password: string) => Promise<boolean>;
    lock: () => Promise<void>;
    isLoading: boolean;
    refreshStatus: () => Promise<void>;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

export function LockProvider({ children }: { children: ReactNode }) {
    const [isLocked, setIsLocked] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();

    const refreshStatus = useCallback(async () => {
        try {
            const response = await fetch("/api/lock/status");
            const data = await response.json();
            if (typeof data.isLocked === 'boolean') {
                setIsLocked(data.isLocked);
            }
        } catch (error) {
            console.error("Failed to fetch lock status:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load lock state from backend on mount and route changes
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus, pathname]);

    const unlock = async (password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/lock/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (data.success) {
                setIsLocked(false);
                return true;
            }

            return false;
        } catch (error) {
            console.error("Unlock error:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const lock = async () => {
        setIsLoading(true);
        try {
            await fetch("/api/lock/lock", { method: "POST" });
            setIsLocked(true);
        } catch (error) {
            console.error("Lock error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LockContext.Provider value={{ isLocked, unlock, lock, isLoading, refreshStatus }}>
            {children}
        </LockContext.Provider>
    );
}

export function useLock() {
    const context = useContext(LockContext);
    if (!context) {
        throw new Error("useLock must be used within a LockProvider");
    }
    return context;
}
