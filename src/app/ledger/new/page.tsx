"use client";

import { Suspense } from "react";
import LedgerEntryForm from "@/components/ledger/LedgerEntryForm";
import { DashboardLayout } from "@/components/layout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function NewLedgerEntryPage() {
    return (
        <DashboardLayout>
            <div className="w-full h-full">
                <Suspense fallback={<div className="flex justify-center p-8"><LoadingSpinner /></div>}>
                    <LedgerEntryForm />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
