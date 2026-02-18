"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
    ArrowRightOnRectangleIcon,
    Bars3Icon,
    BellIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    LockClosedIcon,
    LockOpenIcon,
} from "@heroicons/react/24/outline";
import { reminderTypeLabel } from "@/lib/reminders-shared";
import { useLock } from "@/contexts/LockContext";
import UnlockModal from "@/components/modals/UnlockModal";

type HeaderReminder = {
    id: string;
    type: "low_stock" | "bill_due" | "debt_due";
    source?: { collection: string; id: string };
    title: string;
    message?: string | null;
};

export default function Header({
    setSidebarOpen,
}: {
    setSidebarOpen: (open: boolean) => void;
}) {
    const { data: session, status } = useSession();
    const { isLocked, lock } = useLock();
    const [panelOpen, setPanelOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [loadingReminders, setLoadingReminders] = useState(false);
    const [reminders, setReminders] = useState<HeaderReminder[]>([]);
    const [remindersError, setRemindersError] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const userMenuRef = useRef<HTMLDivElement | null>(null);
    const [totalReminders, setTotalReminders] = useState(0);
    const DROPDOWN_LIMIT = 20;



    const refreshReminders = async () => {
        try {
            setLoadingReminders(true);
            setRemindersError(null);

            const res = await fetch(`/api/reminders?status=triggered&limit=${DROPDOWN_LIMIT}`);
            if (!res.ok) throw new Error(`Failed to load reminders (${res.status})`);

            const data = await res.json();
            setReminders(Array.isArray(data?.reminders) ? data.reminders : []);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load reminders";
            setRemindersError(msg);
            setReminders([]);
        } finally {
            setLoadingReminders(false);
        }
    };

    const refreshRemindersCount = async () => {
        try {
            const res = await fetch(`/api/reminders/count?status=triggered`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to load reminders count");
            const data = await res.json();
            setTotalReminders(Number(data?.total ?? 0));
        } catch {
            // fallback: keep current total, don't force 0
            setTotalReminders((prev) => (prev > 0 ? prev : reminders.length));
        }
    };




    const resolveFromHeader = async (id: string) => {
        try {
            await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resolved: true }),
            });
            await refreshReminders();
            await refreshRemindersCount();
        } catch { }
    };


    // Load on mount (if authenticated) and keep fresh.
    useEffect(() => {
        if (status !== "authenticated") return;

        refreshReminders();
        refreshRemindersCount();

        const t = setInterval(() => {
            refreshReminders();
            refreshRemindersCount();
        }, 60_000);

        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);


    // Close on outside click / escape.
    useEffect(() => {
        if (!panelOpen && !userMenuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (panelOpen && panelRef.current && e.target instanceof Node && !panelRef.current.contains(e.target)) {
                setPanelOpen(false);
            }
            if (userMenuOpen && userMenuRef.current && e.target instanceof Node && !userMenuRef.current.contains(e.target)) {
                setUserMenuOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setPanelOpen(false);
                setUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [panelOpen, userMenuOpen]);
    const visibleCount = totalReminders;
    const badgeText = visibleCount > 99 ? "99+" : String(visibleCount);


    return (
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
                type="button"
                className="lg:hidden -m-2.5 p-2.5 text-gray-700 hover:text-gray-900 cursor-pointer"
                onClick={() => setSidebarOpen(true)}
            >
                <span className="sr-only">Open sidebar</span>
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Separator */}
            <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                {/* Search */}
                <form className="relative flex flex-1" action="#" method="GET">
                </form>

                <div className="flex items-center gap-x-6">
                    {/* Lock button */}
                    <button
                        type="button"
                        className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 cursor-pointer"
                        onClick={() => {
                            if (isLocked) {
                                setUnlockModalOpen(true);
                            } else {
                                lock();
                            }
                        }}
                        title={isLocked ? "Unlock protected features" : "Lock protected features"}
                    >
                        <span className="sr-only">{isLocked ? "Unlock" : "Lock"}</span>
                        {isLocked ? (
                            <LockClosedIcon className="h-6 w-6" aria-hidden="true" />
                        ) : (
                            <LockOpenIcon className="h-6 w-6" aria-hidden="true" />
                        )}
                    </button>

                    {/* Notification button */}
                    <div className="relative" ref={panelRef}>
                        <button
                            type="button"
                            className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 relative cursor-pointer"
                            onClick={() => {
                                const next = !panelOpen;
                                setPanelOpen(next);
                                if (next && status === "authenticated") refreshReminders();
                            }}
                        >
                            <span className="sr-only">View notifications</span>
                            <BellIcon className="h-6 w-6" aria-hidden="true" />
                            {/* Notification badge */}
                            {visibleCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center ring-2 ring-white">
                                    {badgeText}
                                </span>
                            )}
                        </button>

                        {panelOpen && (
                            <div className="fixed inset-x-4 top-20 z-50 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96 sm:max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-gray-900">Notifications</div>
                                    <Link
                                        href="/reminders"
                                        className="text-xs font-medium text-primary hover:underline"
                                        onClick={() => setPanelOpen(false)}
                                    >
                                        View all
                                    </Link>
                                </div>

                                <div className="max-h-96 overflow-y-auto">
                                    {status !== "authenticated" && (
                                        <div className="px-4 py-6 text-sm text-gray-500">
                                            Sign in to view reminders.
                                        </div>
                                    )}

                                    {status === "authenticated" && loadingReminders && (
                                        <div className="px-4 py-6 text-sm text-gray-500">Loading...</div>
                                    )}

                                    {status === "authenticated" && !loadingReminders && remindersError && (
                                        <div className="px-4 py-6 text-sm text-red-600">{remindersError}</div>
                                    )}

                                    {status === "authenticated" && !loadingReminders && !remindersError && reminders.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-gray-500">
                                            No active notifications.
                                        </div>
                                    )}

                                    {status === "authenticated" &&
                                        !loadingReminders &&
                                        !remindersError &&
                                        reminders.map((r) => {
                                            const isLowStock = r.type === "low_stock";
                                            const isBill = r.type === "bill_due";
                                            const isDebt = r.type === "debt_due";

                                            let badgeStyle = "bg-gray-100 text-gray-700 border-gray-200";
                                            if (isLowStock) badgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
                                            if (isBill) badgeStyle = "bg-blue-50 text-blue-700 border-blue-100";
                                            if (isDebt) badgeStyle = "bg-amber-50 text-amber-700 border-amber-100";

                                            return (
                                                <div
                                                    key={r.id}
                                                    className="group px-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/80 transition-all duration-200"
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                                                                {reminderTypeLabel(r.type)}
                                                            </span>
                                                            <button
                                                                className="text-gray-300 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                                title="Dismiss"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    resolveFromHeader(r.id);
                                                                }}
                                                            >
                                                                <XMarkIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <p className="text-sm font-bold text-gray-900 leading-tight">
                                                                {r.title}
                                                            </p>
                                                            {r.message && (
                                                                <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                    {r.message}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-1">
                                                            {isLowStock && r.source?.id && (
                                                                <Link
                                                                    href={`/items/${encodeURIComponent(r.source.id)}/stock`}
                                                                    className="flex-1 text-center text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 py-1.5 rounded-lg transition-colors"
                                                                    onClick={() => setPanelOpen(false)}
                                                                >
                                                                    Restock Now
                                                                </Link>
                                                            )}
                                                            {isBill && r.source?.id && (
                                                                <Link
                                                                    href={`/utilities?edit=${encodeURIComponent(r.source.id)}`}
                                                                    className="flex-1 text-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 py-1.5 rounded-lg transition-colors"
                                                                    onClick={() => setPanelOpen(false)}
                                                                >
                                                                    Pay Bill
                                                                </Link>
                                                            )}
                                                            {isDebt && r.source?.id && (
                                                                <Link
                                                                    href={`/debts`}
                                                                    className="flex-1 text-center text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-100 py-1.5 rounded-lg transition-colors"
                                                                    onClick={() => setPanelOpen(false)}
                                                                >
                                                                    View Loan
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Separator */}
                    <div
                        className="h-6 w-px bg-gray-200"
                        aria-hidden="true"
                    />

                    {/* User info */}
                    <div className="flex items-center gap-x-3 relative" ref={userMenuRef}>
                        {status === "loading" ? (
                            <div className="flex items-center gap-x-3">
                                <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
                                <div className="hidden lg:block space-y-1.5">
                                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                                    <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-x-3 hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                                >
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-semibold text-sm">
                                        {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                                    </div>
                                    <div className="hidden lg:block text-sm text-left">
                                        <p className="font-semibold text-gray-900">
                                            {session?.user?.name || "User"}
                                        </p>
                                        <p className="text-gray-500 text-xs">
                                            {session?.user?.role || "Admin"}
                                        </p>
                                    </div>
                                </button>

                                {userMenuOpen && (
                                    <div
                                        className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden z-50 transform origin-top-right transition-all duration-200 ease-out"
                                        role="menu"
                                    >
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {session?.user?.name || "User"}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5 font-medium truncate">
                                                {session?.user?.email}
                                            </p>
                                        </div>
                                        <div className="p-1">
                                            <button
                                                onClick={() => signOut({ callbackUrl: "/" })}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                role="menuitem"
                                            >
                                                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Unlock Modal */}
            <UnlockModal isOpen={unlockModalOpen} onClose={() => setUnlockModalOpen(false)} />
        </header>
    );
}
