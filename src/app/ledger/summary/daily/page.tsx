"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DashboardLayout } from "@/components/layout";

function DailySummaryContent() {
    const searchParams = useSearchParams();
    const [date, setDate] = useState(
        searchParams.get("date") || new Date().toISOString().split("T")[0]
    );
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSummary();
    }, [date]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/ledger/summary/daily?date=${date}`);
            if (res.ok) {
                setSummary(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Daily Summary</h1>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="p-2 border rounded-lg text-sm"
                />
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : summary ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                                Total Credit
                            </h3>
                            <p className="text-3xl font-bold text-green-600 mt-2">
                                {summary.summary.totalCredit.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                                Total Debit
                            </h3>
                            <p className="text-3xl font-bold text-red-600 mt-2">
                                {summary.summary.totalDebit.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                                Net Result
                            </h3>
                            <p
                                className={`text-3xl font-bold mt-2 ${summary.summary.net >= 0 ? "text-blue-600" : "text-red-600"
                                    }`}
                            >
                                {summary.summary.net.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-semibold text-gray-800">Category Breakdown</h3>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {summary.breakdown.map((cat: any) => (
                                <li
                                    key={cat.name}
                                    className="px-6 py-4 flex justify-between items-center hover:bg-gray-50"
                                >
                                    <span className="font-medium text-gray-700">{cat.name}</span>
                                    <div className="text-right space-x-4 text-sm">
                                        <span className="text-green-600">+{cat.credit.toFixed(2)}</span>
                                        <span className="text-red-500">-{cat.debit.toFixed(2)}</span>
                                    </div>
                                </li>
                            ))}
                            {summary.breakdown.length === 0 && (
                                <li className="p-6 text-center text-gray-500">
                                    No transactions for this day.
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-lg">
                    Failed to load summary.
                </div>
            )}
        </div>
    );
}

export default function DailySummaryPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<LoadingSpinner />}>
                <DailySummaryContent />
            </Suspense>
        </DashboardLayout>
    );
}
