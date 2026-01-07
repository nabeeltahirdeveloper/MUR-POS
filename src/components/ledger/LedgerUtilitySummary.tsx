"use client";

import React, { useEffect, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";

interface Utility {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    category?: string;
    status: 'paid' | 'unpaid';
    createdAt: string;
}

interface LedgerUtilitySummaryProps {
    filters?: {
        search?: string;
        from?: string;
        to?: string;
    };
}

export default function LedgerUtilitySummary({ filters }: LedgerUtilitySummaryProps) {
    const [utilities, setUtilities] = useState<Utility[]>([]);
    const [filteredUtilities, setFilteredUtilities] = useState<Utility[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUtilities();
    }, []);

    useEffect(() => {
        filterUtilities();
    }, [utilities, filters]);

    const fetchUtilities = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/utilities");
            if (res.ok) {
                const data = await res.json();
                setUtilities(data);
            }
        } catch (error) {
            console.error("Failed to fetch utilities:", error);
        } finally {
            setLoading(false);
        }
    };

    const filterUtilities = () => {
        let valid = [...utilities];

        if (filters?.search) {
            const term = filters.search.toLowerCase();
            valid = valid.filter(u =>
                u.name.toLowerCase().includes(term) ||
                (u.category && u.category.toLowerCase().includes(term))
            );
        }

        if (filters?.from) {
            const from = new Date(filters.from);
            from.setHours(0, 0, 0, 0);
            // Using dueDate for utilities filtering as it's usually more relevant, 
            // but sticking to createdAt if that's the standard for "Ledger"
            // Let's us createdAt for consistency with other ledger views which show "When it was recorded"
            valid = valid.filter(u => new Date(u.createdAt) >= from);
        }

        if (filters?.to) {
            const to = new Date(filters.to);
            to.setHours(23, 59, 59, 999);
            valid = valid.filter(u => new Date(u.createdAt) <= to);
        }

        setFilteredUtilities(valid);
    };

    const columns = [
        {
            key: "dueDate",
            header: "Due Date",
            render: (value: any) => new Date(value).toLocaleDateString(),
        },
        {
            key: "name",
            header: "Utility Name",
            render: (value: any) => <span className="font-medium text-gray-900">{value}</span>,
        },
        {
            key: "category",
            header: "Category",
            render: (value: any) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {value || "General"}
                </span>
            ),
        },
        {
            key: "amount",
            header: "Amount",
            render: (value: any) => (
                <span className="font-mono font-bold text-gray-900">
                    Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (value: any) => (
                <span className={`text-xs uppercase font-bold tracking-wider px-2 py-1 rounded-full ${value === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {value}
                </span>
            ),
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: Utility) => (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.location.href = `/utilities`} // Redirect to utilities management
                    title="Manage in Utilities Page"
                >
                    Manage
                </Button>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="font-medium text-gray-900">Utility Bills</h3>
                <span className="text-xs text-gray-500">Showing all records from Utilities book</span>
            </div>
            <Table
                data={filteredUtilities}
                columns={columns}
                emptyMessage="No utility records found."
            />
        </div>
    );
}
