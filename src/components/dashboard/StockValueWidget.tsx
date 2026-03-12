"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BanknotesIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useLock } from "@/contexts/LockContext";

export default function StockValueWidget() {
    const { isLocked } = useLock();
    const [stats, setStats] = useState({ totalValue: 0, totalItems: 0 });
    const [loading, setLoading] = useState(true);

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data, error, isLoading } = useSWR("/api/items", fetcher);

    useEffect(() => {
        if (Array.isArray(data)) {
            const totalValue = data.reduce((acc: number, item: any) => {
                const stock = item.currentStock || 0;
                const price = item.secondPurchasePrice || 0;
                return acc + (stock * price);
            }, 0);
            setStats({ totalValue, totalItems: data.length });
            setLoading(false);
        }
    }, [data]);

    if (isLocked) return null;

    if (loading) return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-100 rounded w-48"></div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">Stock Value Overview</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                        Rs. {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Based on {stats.totalItems} items</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                    <BanknotesIcon className="h-6 w-6 text-primary" />
                </div>
            </div>
        </div>
    );
}
