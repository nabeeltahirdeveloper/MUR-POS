"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export default function LowStockWidget() {
    const [lowStockItems, setLowStockItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/items")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const low = data.filter((item: any) => item.isLowStock);
                    setLowStockItems(low.slice(0, 5));
                }
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-4 bg-gray-100 rounded w-full"></div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                    <h3 className="font-bold text-gray-900">Low Stock Items</h3>
                </div>
                <Link
                    href="/items"
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                    View All →
                </Link>
            </div>
            <div className="flex-1">
                {lowStockItems.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {lowStockItems.map((item) => (
                            <div
                                key={item.id}
                                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors"
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900">{item.name}</span>
                                    <span className="text-xs text-gray-500">
                                        Min Stock: {item.minStockLevel}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-bold text-red-600">
                                        {item.currentStock} {item.saleUnit?.symbol || item.baseUnit?.symbol}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                                        {item.category?.name || "General"}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <div className="p-3 bg-green-50 rounded-full mb-3">
                            <ExclamationTriangleIcon className="h-6 w-6 text-green-500" />
                        </div>
                        <p className="text-gray-500 font-medium">Stock levels healthy!</p>
                        <p className="text-xs text-gray-400 mt-1">All items are above minimum stock levels.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
