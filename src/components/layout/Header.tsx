"use client";

import { useSession } from "next-auth/react";
import {
    Bars3Icon,
    BellIcon,
    MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

export default function Header({
    setSidebarOpen,
}: {
    setSidebarOpen: (open: boolean) => void;
}) {
    const { data: session } = useSession();

    return (
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
                type="button"
                className="lg:hidden -m-2.5 p-2.5 text-gray-700 hover:text-gray-900"
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
                    <label htmlFor="search-field" className="sr-only">
                        Search
                    </label>
                    <MagnifyingGlassIcon
                        className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
                        aria-hidden="true"
                    />
                    <input
                        id="search-field"
                        className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm bg-transparent"
                        placeholder="Search..."
                        type="search"
                        name="search"
                    />
                </form>

                <div className="flex items-center gap-x-4 lg:gap-x-6">
                    {/* Notification button */}
                    <button
                        type="button"
                        className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 relative"
                    >
                        <span className="sr-only">View notifications</span>
                        <BellIcon className="h-6 w-6" aria-hidden="true" />
                        {/* Notification badge */}
                        <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                    </button>

                    {/* Separator */}
                    <div
                        className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
                        aria-hidden="true"
                    />

                    {/* User info (desktop only) */}
                    <div className="hidden lg:flex lg:items-center lg:gap-x-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-semibold text-sm">
                            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-gray-900">
                                {session?.user?.name || "User"}
                            </p>
                            <p className="text-gray-500 text-xs">
                                {session?.user?.role || "Admin"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
