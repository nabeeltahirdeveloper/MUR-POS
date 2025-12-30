"use client";

import { Suspense } from "react";
import LedgerEntryForm from "@/components/ledger/LedgerEntryForm";
import { DashboardLayout } from "@/components/layout";

export default function NewLedgerEntryPage() {
    return (
        <DashboardLayout>
            <div className="w-full h-full">
                <Suspense fallback={<div>Loading...</div>}>
                    <LedgerEntryForm />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
