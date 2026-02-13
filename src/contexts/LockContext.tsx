"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface LockContextType {
    isLocked: boolean;
    unlock: (password: string) => Promise<boolean>;
    lock: () => void;
    isLoading: boolean;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

const LOCK_STATE_KEY = "jbc_lock_state";

export function LockProvider({ children }: { children: ReactNode }) {
    const [isLocked, setIsLocked] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // Load lock state from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(LOCK_STATE_KEY);
        if (stored === "unlocked") {
            setIsLocked(false);
        }
    }, []);

    const unlock = async (password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (data.success) {
                setIsLocked(false);
                localStorage.setItem(LOCK_STATE_KEY, "unlocked");
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

    const lock = () => {
        setIsLocked(true);
        localStorage.setItem(LOCK_STATE_KEY, "locked");
    };

    return (
        <LockContext.Provider value={{ isLocked, unlock, lock, isLoading }}>
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
