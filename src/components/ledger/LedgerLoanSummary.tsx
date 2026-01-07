"use client";

import React, { useEffect, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";

interface Debt {
    id: string;
    personName: string;
    type: 'loaned_out' | 'loaned_in';
    amount: number;
    dueDate?: string;
    note?: string;
    status: 'active' | 'paid';
    createdAt: string;
}

interface LedgerLoanSummaryProps {
    filters?: {
        search?: string;
        from?: string;
        to?: string;
    };
}

export default function LedgerLoanSummary({ filters }: LedgerLoanSummaryProps) {
    const [debts, setDebts] = useState<Debt[]>([]);
    const [filteredDebts, setFilteredDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDebts();
    }, []);

    useEffect(() => {
        filterDebts();
    }, [debts, filters]);

    const fetchDebts = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/debts");
            if (res.ok) {
                const data = await res.json();
                setDebts(data);
            }
        } catch (error) {
            console.error("Failed to fetch debts:", error);
        } finally {
            setLoading(false);
        }
    };

    const filterDebts = () => {
        let valid = [...debts];

        if (filters?.search) {
            const term = filters.search.toLowerCase();
            valid = valid.filter(d =>
                d.personName.toLowerCase().includes(term) ||
                (d.note && d.note.toLowerCase().includes(term))
            );
        }

        if (filters?.from) {
            const from = new Date(filters.from);
            from.setHours(0, 0, 0, 0);
            valid = valid.filter(d => new Date(d.createdAt) >= from);
        }

        if (filters?.to) {
            const to = new Date(filters.to);
            to.setHours(23, 59, 59, 999);
            valid = valid.filter(d => new Date(d.createdAt) <= to);
        }

        setFilteredDebts(valid);
    };

    const columns = [
        {
            key: "createdAt",
            header: "Date",
            render: (value: any) => new Date(value).toLocaleDateString(),
        },
        {
            key: "personName",
            header: "Person / Party",
            render: (value: any) => <span className="font-medium text-gray-900">{value}</span>,
        },
        {
            key: "type",
            header: "Type",
            render: (value: any) => (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value === 'loaned_in'
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                        }`}
                >
                    {value === 'loaned_in' ? 'Borrowed' : 'Lent'}
                </span>
            ),
        },
        {
            key: "amount",
            header: "Amount",
            render: (value: any, row: Debt) => (
                <span className={`font-mono font-bold ${row.type === 'loaned_out' ? "text-green-600" : "text-red-600"
                    }`}>
                    Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (value: any) => (
                <span className={`text-xs uppercase font-bold tracking-wider ${value === 'active' ? 'text-blue-600' : 'text-gray-400'}`}>
                    {value}
                </span>
            ),
        },
        {
            key: "note",
            header: "Note",
            render: (value: any) => <span className="text-gray-500 text-sm italic">{value || "-"}</span>,
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: Debt) => (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.location.href = `/debts`} // Redirect to debts management
                    title="Manage in Debts Page"
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
                <h3 className="font-medium text-gray-900">Active Debt Records</h3>
                <span className="text-xs text-gray-500">Showing all records from Debts book</span>
            </div>
            <Table
                data={filteredDebts}
                columns={columns}
                emptyMessage="No loan records found."
            />
        </div>
    );
}
