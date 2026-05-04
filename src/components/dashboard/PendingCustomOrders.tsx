import { useEffect, useState } from "react";
import useSWR from "swr";
import { ClipboardDocumentListIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

interface CustomOrder {
    id: string;
    date: string;
    itemName: string;
    quantity: number;
    price: number;
    partyName: string;
    originalNote: string;
}

export default function PendingCustomOrders() {
    const [orders, setOrders] = useState<CustomOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetcher = (url: string) => fetch(url).then((res) => res.json());
    const { data } = useSWR("/api/ledger?search=[Customize]&limit=100", fetcher);

    useEffect(() => {
        if (data?.data && Array.isArray(data.data)) {
            const parsed = data.data.map((entry: any) => {
                const match = entry.note?.match(/Item: \[Customize\]\s*(.*?)\s*\(Qty: (\d+)/);
                if (match) {
                    return {
                        id: entry.id,
                        date: entry.date,
                        itemName: match[1],
                        quantity: Number(match[2]),
                        price: entry.amount,
                        partyName: entry.note?.match(/Customer: (.*?)(?:\n|$)/)?.[1] || "Unknown",
                        originalNote: entry.note
                    };
                }
                return null;
            }).filter((item: any) => item !== null);

            setOrders(parsed);
            setLoading(false);
        }
    }, [data]);

    const handleReceive = (order: CustomOrder) => {
        // Navigate to a receive page or open modal?
        // Since we need complex input (Category, Cost Price, etc.), a dedicated page might be better or a query param.
        // Let's use a query param on the inventory page or a dedicated receive route.
        // Plan said: "Create UI to define item details".
        // Let's create a new page: /inventory/receive-custom/[ledgerId]
        router.push(`/items/receive-custom?ledgerId=${order.id}&name=${encodeURIComponent(order.itemName)}&qty=${order.quantity}`);
    };

    if (loading) return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
                {[1, 2].map(i => (
                    <div key={i} className="h-4 bg-gray-100 rounded w-full"></div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-lg">
                        <ClipboardDocumentListIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <h3 className="font-bold text-gray-900">Pending Custom Orders</h3>
                </div>
                <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">{orders.length}</span>
            </div>
            <div className="flex-1">
                {orders.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {orders.map((order) => (
                            <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                <div className="flex flex-col gap-1">
                                    <span className="font-bold text-gray-900">{order.itemName}</span>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="font-medium bg-gray-100 px-1.5 rounded">{order.quantity} units</span>
                                        <span>•</span>
                                        <span>{order.partyName}</span>
                                        <span>•</span>
                                        <span>{new Date(order.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleReceive(order)}
                                    className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-lg shadow-sm transition-all transform active:scale-95 cursor-pointer"
                                >
                                    Receive
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                        <div className="p-3 bg-gray-100 rounded-full mb-3">
                            <CheckCircleIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-bold text-gray-500 mb-1">No Pending Custom Orders</p>
                        <p className="text-xs text-gray-400">All custom items have been processed.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
