"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout";
import { reminderTypeLabel } from "@/lib/reminders-shared";

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
      const res = await fetch(`/api/reminders?status=${encodeURIComponent(status)}&limit=100`);
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
      await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      });
      await fetchReminders(tab);
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
            <p className="text-sm text-gray-500 mt-1">
              {tab === "triggered" ? "Triggered" : tab === "pending" ? "Pending" : "All"} reminders
              {rows.length > 0 ? ` (${counts.total})` : ""}
            </p>
          </div>

          <button
            onClick={() => fetchReminders(tab)}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["triggered", "pending", "all"] as StatusTab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                tab === k
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {k === "triggered" ? "Triggered" : k === "pending" ? "Pending" : "All"}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && <div className="text-sm text-gray-500">Loading...</div>}

        {!loading && !error && rows.length === 0 && (
          <div className="p-6 rounded-xl border border-gray-200 bg-white text-sm text-gray-500">
            No reminders found.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Trigger date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {reminderTypeLabel(r.type as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {r.title || r.id}
                        {r.triggered ? (
                          <span className="ml-2 text-[11px] font-semibold text-red-600">Triggered</span>
                        ) : (
                          <span className="ml-2 text-[11px] font-semibold text-yellow-700">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[520px]">
                        <div className="line-clamp-2">{r.message || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(r.triggerAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {r.type === "low_stock" && r.source?.id ? (
                          <Link
                            href={`/items/${encodeURIComponent(r.source.id)}/stock`}
                            className="text-sm font-medium text-blue-700 hover:underline"
                          >
                            Restock
                          </Link>
                        ) : (
                          <button
                            onClick={() => resolveReminder(r.id)}
                            className="text-sm font-medium text-green-700 hover:underline"
                          >
                            Resolve
                          </button>
                        )}
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


