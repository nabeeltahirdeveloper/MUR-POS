"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

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
    UserGroupIcon,
    ChevronDownIcon,
    CalendarDaysIcon,
    CalendarIcon,
    BellAlertIcon,
    BanknotesIcon,
    Cog6ToothIcon,
} from "@heroicons/react/24/outline";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
    { name: "Inventory", href: "/items", icon: CubeIcon },
    { name: "Purchase Orders", href: "/purchase-orders", icon: DocumentTextIcon },
    { name: "Suppliers", href: "/suppliers", icon: UserCircleIcon },
    { name: "Customers", href: "/customers", icon: UserGroupIcon },
    {
        name: "Ledger",
        href: "/ledger",
        icon: ChartBarIcon,
        children: [
            { name: "All Entries", href: "/ledger" },
            { name: "Daily Summary", href: "/ledger/summary/daily", icon: CalendarIcon },
            { name: "Monthly Summary", href: "/ledger/summary/monthly", icon: CalendarDaysIcon },
            { name: "By Customer", href: "/ledger?view=customers", icon: UserGroupIcon },
            { name: "By Supplier", href: "/ledger?view=suppliers", icon: UserCircleIcon },
        ],
    },
    { name: "Reminders", href: "/reminders", icon: BellAlertIcon },
    { name: "Utilities", href: "/utilities", icon: BoltIcon },
    { name: "Loan-In & Loan-Out", href: "/debts", icon: BanknotesIcon },
    { name: "Settings", href: "/settings", icon: Cog6ToothIcon },
];

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
}: {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [expandedItems, setExpandedItems] = useState<string[]>(["Ledger"]);
    const [businessName, setBusinessName] = useState("Moon Traders");

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    if (data?.businessProfile?.name) {
                        setBusinessName(data.businessProfile.name);
                    }
                }
            } catch (error) {
                // fallback to default
            }
        };
        fetchSettings();
    }, []);

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
                <img src="/favicon.jpg" alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                <span className="ml-2 text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                    {businessName}
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto min-h-0 sidebar-scrollbar">
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
                                        } cursor-pointer`}
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
                                        ? "bg-primary/10 text-primary border-l-2 border-primary"
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
                                        // Logic to determine if child is active
                                        let childActive = false;
                                        if (child.href === "/ledger") {
                                            // Active if patchname is ledger AND no view param (or view=entries)
                                            childActive = pathname === "/ledger" && (!searchParams.get("view") || searchParams.get("view") === "entries");
                                        } else if (child.href.includes("?")) {
                                            // Check strict match of pathname + query
                                            const [path, query] = child.href.split("?");
                                            const params = new URLSearchParams(query);
                                            const currentView = searchParams.get("view");
                                            const targetView = params.get("view");
                                            childActive = pathname === path && currentView === targetView;
                                        } else {
                                            childActive = pathname === child.href;
                                        }

                                        return (
                                            <Link
                                                key={child.href}
                                                href={child.href}
                                                onClick={() => setSidebarOpen(false)}
                                                className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 ${childActive
                                                    ? "bg-primary/10 text-primary"
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



            {/* Sign Out Section */}
            <div className="border-t border-slate-800 p-4 shrink-0 mt-auto">
                <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full group flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all duration-200 cursor-pointer"
                >
                    <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
                    Sign Out
                </button>
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
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex flex-col h-full overflow-hidden">
                    <NavContent />
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-72 lg:flex-col">
                <div className="flex flex-col flex-grow bg-slate-900 border-r border-slate-800 overflow-hidden">
                    <NavContent />
                </div>
            </div>
        </>
    );
}
