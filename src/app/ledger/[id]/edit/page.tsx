"use client";

import { useState, useEffect, Suspense } from "react";
import LedgerEntryForm from "@/components/ledger/LedgerEntryForm";
import { useParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DashboardLayout } from "@/components/layout";

export default function EditLedgerEntryPage() {
    const params = useParams();
    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params?.id) {
            fetchEntry(String(params.id));
        }
    }, [params]);

    const fetchEntry = async (id: string) => {
        try {
            const res = await fetch(`/api/ledger/${id}`);
            if (res.ok) {
                const data = await res.json();
                setEntry(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="w-full h-full">
                {loading ? (
                    <LoadingSpinner />
                ) : entry ? (
                    <Suspense fallback={<LoadingSpinner />}>
                        <LedgerEntryForm initialData={entry} />
                    </Suspense>
                ) : (
                    <div className="text-center py-12 text-gray-500">Entry not found</div>
                )}
            </div>
        </DashboardLayout>
    );
}
