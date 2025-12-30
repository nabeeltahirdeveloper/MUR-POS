"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ThermalReceipt, { ReceiptData, ReceiptItem } from "@/components/ledger/ThermalReceipt";

interface PurchaseOrderItem {
    itemId: string;
    qty: number;
    pricePerUnit: number;
    item?: { name?: string | null } | null;
}

interface PurchaseOrder {
    id: string;
    createdAt: string | Date;
    status: string;
    supplier?: { name?: string | null; phone?: string | null; address?: string | null } | null;
    notes?: string | null;
    terms?: string | null;
    items: PurchaseOrderItem[];
}

export default function PrintPurchaseOrderPage() {
    const params = useParams();
    const id = params.id as string;
    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/purchase-orders/${id}`)
            .then(res => res.json())
            .then(data => {
                setPo(data);
                setLoading(false);
                setError(null);
            })
            .catch((e) => {
                console.error(e);
                setError("Failed to load purchase order");
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!po) return;
        document.title = `PO-${po.id}`;
    }, [po]);

    if (loading) return <div className="p-8">Loading...</div>;
    if (error) return <div className="p-8 text-red-600">{error}</div>;
    if (!po) return <div className="p-8">Not found</div>;

    // Transform PO data to ThermalReceipt structure
    const items = (Array.isArray(po.items) ? po.items : []).map(i => ({
        name: i.item?.name || "Unknown Item",
        quantity: Number(i.qty) || 0,
        unitPrice: Number(i.pricePerUnit) || 0,
        amount: (Number(i.qty) || 0) * (Number(i.pricePerUnit) || 0)
    }));

    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const supplier = po.supplier || {};

    const receiptData: ReceiptData = {
        title: "PURCHASE ORDER",
        id: `PO-${po.id}`,
        date: po.createdAt,
        status: po.status,
        customerName: supplier.name || undefined,
        customerPhone: supplier.phone || undefined,
        customerAddress: supplier.address || undefined,
        items: items,
        total: total,
        notes: po.notes || undefined,
        terms: po.terms || undefined
    };

    return (
        <ThermalReceipt data={receiptData} onClose={() => window.close()} />
    );
}
