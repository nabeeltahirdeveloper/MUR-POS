'use client';

import { SessionProvider } from "next-auth/react";
import { SessionManager } from "./SessionManager";
import { AlertProvider } from "@/contexts/AlertContext";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <SessionManager />
            <AlertProvider>
                {children}
            </AlertProvider>
        </SessionProvider>
    );
}
