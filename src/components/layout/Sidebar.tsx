"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    Bars3Icon,
    XMarkIcon,
    HomeIcon,
    CubeIcon,
    ChartBarIcon,
    DocumentTextIcon,
    BoltIcon,
    ArrowRightOnRectangleIcon,
    UserCircleIcon,
    ChevronDownIcon,
    CalendarDaysIcon,
    CalendarIcon,
} from "@heroicons/react/24/outline";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
    { name: "Inventory", href: "/items", icon: CubeIcon },
    {
        name: "Ledger",
        href: "/ledger",
        icon: ChartBarIcon,
        children: [
            { name: "All Entries", href: "/ledger" },
            { name: "Daily Summary", href: "/ledger/summary/daily", icon: CalendarIcon },
            { name: "Monthly Summary", href: "/ledger/summary/monthly", icon: CalendarDaysIcon },
        ],
    },
];

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
}: {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}) {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [expandedItems, setExpandedItems] = useState<string[]>(["Ledger"]);

    const toggleExpanded = (name: string) => {
        setExpandedItems((prev) =>
            prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
        );
    };

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === href;
        return pathname.startsWith(href);
    };

    const NavContent = () => (
        <>
            {/* Logo */}
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-slate-800">
                <BoltIcon className="h-8 w-8 text-amber-500" />
                <span className="ml-2 text-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                    Moon Traders
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                    const active = isActive(item.href);
                    const hasChildren = item.children && item.children.length > 0;
                    const isExpanded = expandedItems.includes(item.name);

                    return (
                        <div key={item.name}>
                            {hasChildren ? (
                                <button
                                    onClick={() => toggleExpanded(item.name)}
                                    className={`w-full group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${active
                                            ? "bg-slate-800 text-white"
                                            : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className="h-5 w-5 shrink-0" />
                                        {item.name}
                                    </div>
                                    <ChevronDownIcon
                                        className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>
                            ) : (
                                <Link
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${active
                                            ? "bg-amber-500/10 text-amber-500 border-l-2 border-amber-500"
                                            : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                                        }`}
                                >
                                    <item.icon className="h-5 w-5 shrink-0" />
                                    {item.name}
                                </Link>
                            )}

                            {/* Sub-navigation */}
                            {hasChildren && isExpanded && (
                                <div className="mt-1 ml-4 pl-4 border-l border-slate-700 space-y-1">
                                    {item.children?.map((child) => {
                                        const childActive = pathname === child.href;
                                        return (
                                            <Link
                                                key={child.href}
                                                href={child.href}
                                                onClick={() => setSidebarOpen(false)}
                                                className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 ${childActive
                                                        ? "bg-amber-500/10 text-amber-500"
                                                        : "text-slate-500 hover:bg-slate-800/50 hover:text-white"
                                                    }`}
                                            >
                                                {child.icon && <child.icon className="h-4 w-4" />}
                                                {child.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* User section */}
            <div className="border-t border-slate-800 p-4">
                {status === "loading" ? (
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="h-9 w-9 rounded-full bg-slate-700 animate-pulse" />
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
                            <div className="h-3 w-32 bg-slate-700 rounded animate-pulse" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 px-3 py-2">
                            <UserCircleIcon className="h-9 w-9 text-slate-500" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {session?.user?.name || "User"}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                    {session?.user?.email}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                        >
                            <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            Sign Out
                        </button>
                    </>
                )}
            </div>
        </>
    );

    return (
        <>
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 transform transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="absolute top-4 right-4">
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex flex-col h-full">
                    <NavContent />
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-72 lg:flex-col">
                <div className="flex flex-col flex-grow bg-slate-900 border-r border-slate-800">
                    <NavContent />
                </div>
            </div>
        </>
    );
}
