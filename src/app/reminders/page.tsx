"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout";
import { reminderTypeLabel } from "@/lib/reminders-shared";
import { BellIcon } from "@heroicons/react/24/outline";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type StatusTab = "triggered" | "pending" | "all";

type ReminderRow = {
  id: string;
  type: "low_stock" | "bill_due" | "debt_due" | string;
  source?: { collection: string; id: string };
  title?: string;
  message?: string | null;
  triggered?: boolean;
  triggerAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  resolvedAt?: string | Date | null;
};

function fmtDate(input: unknown): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input as any);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

export default function RemindersPage() {
  const [tab, setTab] = useState<StatusTab>("triggered");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReminderRow[]>([]);

  const fetchReminders = async (status: StatusTab) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/reminders?status=${encodeURIComponent(status)}&limit=500`);
      if (res.status === 401) {
        setRows([]);
        setError("Unauthorized. Please sign in.");
        return;
      }
      if (!res.ok) throw new Error(`Failed to load reminders (${res.status})`);
      const data = await res.json();
      setRows(Array.isArray(data?.reminders) ? data.reminders : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const resolveReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      });
      if (res.ok) {
        setRows(prev => prev.filter(r => r.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const counts = useMemo(() => {
    const triggered = rows.filter((r) => r.triggered).length;
    const pending = rows.filter((r) => !r.triggered).length;
    return { total: rows.length, triggered, pending };
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications & Reminders</h1>
            <p className="text-sm text-gray-500 mt-1">
              Stay updated on stock levels, utility bills, and loan repayments.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
            {(["triggered", "pending", "all"] as StatusTab[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${tab === k
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <LoadingSpinner />
            <p className="text-sm text-gray-500 font-medium">Fetching active reminders...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
            <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BellIcon className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-900 font-semibold text-lg">All caught up!</p>
            <p className="text-gray-500 text-sm mt-1">No {tab} reminders found at the moment.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Source & Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Trigger Plane</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight w-fit ${r.type === "low_stock" ? "bg-red-50 text-red-700 border border-red-100" :
                            r.type === "bill_due" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                              "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}>
                            {reminderTypeLabel(r.type as any)}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">
                            {r.source?.collection || "system"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{r.title || r.id}</span>
                            {r.triggered ? (
                              <span className="flex h-1.5 w-1.5 rounded-full bg-red-500" />
                            ) : (
                              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1 group-hover:line-clamp-none transition-all">
                            {r.message || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-700">{fmtDate(r.triggerAt)}</span>
                          <span className="text-[11px] text-gray-400">Scheduled Check</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-3">
                          {r.type === "low_stock" && r.source?.id && (
                            <Link
                              href={`/items/${encodeURIComponent(r.source.id)}/stock`}
                              className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary hover:text-white transition-all"
                            >
                              Refill Stock
                            </Link>
                          )}
                          <button
                            onClick={() => resolveReminder(r.id)}
                            className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-200 border border-transparent transition-all"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


