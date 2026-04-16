"use client";

import React, { Suspense } from "react";
import { ItemForm } from "@/components/inventory/ItemForm";
import { DashboardLayout } from "@/components/layout";
import { useSearchParams } from "next/navigation";

function ReceiveCustomContent() {
    const searchParams = useSearchParams();
    const ledgerId = searchParams?.get("ledgerId");
    const name = searchParams?.get("name");
    const quantity = searchParams?.get("qty");

    // Optional: We could try to infer more, but name is the main thing.

    // Initial data with the custom name
    const initialData: any = {
        name: name || "",
        // We can't infer other fields, user must fill them.
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6">
                <h2 className="text-lg font-bold text-purple-900">Receive Custom Order</h2>
                <p className="text-sm text-purple-700">
                    You are creating a new inventory item for a pending custom order.
                    Once saved, the item will be added to inventory and the pending order will be marked as processed.
                </p>
                <div className="mt-2 text-sm font-mono bg-white p-2 rounded text-purple-900 font-semibold">
                    Ledger Ref: {ledgerId || "N/A"}
                </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">Define New Item Details</h1>

            <ItemForm
                initialData={initialData}
                customSubmitUrl="/api/inventory/receive-custom"
                additionalBody={{
                    ledgerId,
                    initialQuantity: quantity // Pass the quantity so we can set efficient stock?
                    // Actually, the API should handle stock creation.
                    // The standard ItemForm doesn't let you set initial stock usually (it's 0).
                    // But here we are "Receiving", implying we HAVE the stock now.
                }}
            />
        </div>
    );
}

export default function ReceiveCustomPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<div>Loading...</div>}>
                <ReceiveCustomContent />
            </Suspense>
        </DashboardLayout>
    );
}
