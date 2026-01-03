"use client";

import React, { useEffect, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";

interface CustomerSummary {
    name: string;
    balance: number;
    lastEntryDate: string;
    totalCredit: number;
    totalDebit: number;
}

interface LedgerCustomerSummaryProps {
    onViewEntries: (customerName: string) => void;
}

export default function LedgerCustomerSummary({ onViewEntries }: LedgerCustomerSummaryProps) {
    const [customers, setCustomers] = useState<CustomerSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ledger/customers");
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (error) {
            console.error("Failed to fetch customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            key: "name",
            header: "Customer Name",
            render: (value: any) => <span className="font-medium text-gray-900">{value}</span>,
        },
        {
            key: "totalCredit",
            header: "Total In (Credit)",
            render: (value: any) => (
                <span className="text-green-600 font-mono">
                    Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            key: "totalDebit",
            header: "Total Out (Debit)",
            render: (value: any) => (
                <span className="text-red-600 font-mono">
                    Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            key: "balance",
            header: "Net Balance",
            render: (value: any) => (
                <span className={`font-bold font-mono ${Number(value) >= 0 ? "text-green-700" : "text-red-700"}`}>
                    Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            key: "lastEntryDate",
            header: "Last Transaction",
            render: (value: any) => value ? new Date(value).toLocaleDateString() : "-",
        },
        {
            key: "actions",
            header: "Actions",
            render: (_: any, row: CustomerSummary) => (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onViewEntries(row.name)}
                >
                    View Entries
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
            <Table
                data={customers}
                columns={columns}
                emptyMessage="No customers found in ledger."
            />
        </div>
    );
}
