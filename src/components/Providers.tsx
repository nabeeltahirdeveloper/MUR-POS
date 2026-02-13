'use client';

import { SessionProvider } from "next-auth/react";
import { SessionManager } from "./SessionManager";
import { AlertProvider } from "@/contexts/AlertContext";
import { LockProvider } from "@/contexts/LockContext";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <SessionManager />
            <LockProvider>
                <AlertProvider>
                    {children}
                </AlertProvider>
            </LockProvider>
        </SessionProvider>
    );
}
