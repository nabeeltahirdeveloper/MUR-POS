"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { DashboardLayout } from "@/components/layout";

function MonthlySummaryContent() {
    const searchParams = useSearchParams();

    const now = new Date();
    const [month, setMonth] = useState(
        parseInt(searchParams.get("month") || "") || now.getMonth() + 1
    );
    const [year, setYear] = useState(
        parseInt(searchParams.get("year") || "") || now.getFullYear()
    );

    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSummary();
    }, [month, year]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/ledger/summary/monthly?year=${year}&month=${month}`
            );
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
                <h1 className="text-2xl font-bold text-gray-900">Monthly Summary</h1>
                <div className="flex gap-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="p-2 border rounded-lg text-sm"
                    >
                        {[...Array(12)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(0, i).toLocaleString("default", { month: "long" })}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="p-2 border rounded-lg w-24 text-sm"
                        min="2000"
                        max="2100"
                    />
                </div>
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : summary ? (
                <div className="space-y-6">
                    {/* Totals Cards */}
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Daily Breakdown */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-semibold text-gray-800">Daily Breakdown</h3>
                            </div>
                            <div className="overflow-x-auto max-h-96">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                Credit
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                Debit
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                Net
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {summary.daily.map((day: any) => (
                                            <tr key={day.date} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                    {day.date}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right text-green-600">
                                                    {day.credit.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right text-red-600">
                                                    {day.debit.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right font-medium">
                                                    <span
                                                        className={
                                                            day.net >= 0 ? "text-blue-600" : "text-red-600"
                                                        }
                                                    >
                                                        {day.net.toFixed(2)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {summary.daily.length === 0 && (
                                    <div className="p-6 text-center text-gray-500">
                                        No entries for this month.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Category Breakdown */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-semibold text-gray-800">Category Breakdown</h3>
                            </div>
                            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                {summary.categories.map((cat: any) => (
                                    <li
                                        key={cat.name}
                                        className="px-6 py-4 flex justify-between items-center hover:bg-gray-50"
                                    >
                                        <span className="font-medium text-gray-700">{cat.name}</span>
                                        <div className="text-right space-x-4 text-sm">
                                            <span className="text-green-600">
                                                +{cat.credit.toFixed(2)}
                                            </span>
                                            <span className="text-red-500">-{cat.debit.toFixed(2)}</span>
                                        </div>
                                    </li>
                                ))}
                                {summary.categories.length === 0 && (
                                    <li className="p-6 text-center text-gray-500">
                                        No entries for this month.
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-lg">
                    Unable to load summary data.
                </div>
            )}
        </div>
    );
}

export default function MonthlySummaryPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<LoadingSpinner />}>
                <MonthlySummaryContent />
            </Suspense>
        </DashboardLayout>
    );
}
