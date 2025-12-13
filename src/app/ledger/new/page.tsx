"use client";

import LedgerEntryForm from "@/components/ledger/LedgerEntryForm";
import { DashboardLayout } from "@/components/layout";

export default function NewLedgerEntryPage() {
    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto">
                <LedgerEntryForm />
            </div>
        </DashboardLayout>
    );
}
