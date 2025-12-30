"use client";

import LedgerEntryForm from "@/components/ledger/LedgerEntryForm";
import { DashboardLayout } from "@/components/layout";

export default function NewLedgerEntryPage() {
    return (
        <DashboardLayout>
            <div className="w-full h-full">
                <LedgerEntryForm />
            </div>
        </DashboardLayout>
    );
}
