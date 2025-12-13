"use client";

import React from "react";
import { ItemForm } from "@/components/inventory/ItemForm";
import { DashboardLayout } from "@/components/layout";

export default function NewItemPage() {
    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Create New Item</h1>
                <ItemForm />
            </div>
        </DashboardLayout>
    );
}
