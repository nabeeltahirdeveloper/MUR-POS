"use client";

import React, { useEffect, useState } from "react";
import useSWR from "swr";
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
    filters?: {
        from?: string;
        to?: string;
        search?: string;
    };
}

export default function LedgerCustomerSummary({ onViewEntries, filters }: LedgerCustomerSummaryProps) {
    const [customers, setCustomers] = useState<CustomerSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const fetcher = (url: string) => fetch(url).then(res => res.json());
    
    const query = new URLSearchParams();
    if (filters?.from) query.append("from", filters.from);
    if (filters?.to) query.append("to", filters.to);
    
    const { data: rawData, isLoading: swrLoading } = useSWR(`/api/ledger/customers?${query.toString()}`, fetcher);

    useEffect(() => {
        if (rawData) {
            let filtered = rawData;
            if (filters?.search) {
                const term = filters.search.toLowerCase();
                filtered = filtered.filter((c: CustomerSummary) => c.name.toLowerCase().includes(term));
            }
            setCustomers(filtered);
            setLoading(false);
        }
    }, [rawData, filters?.search]);

    const columns = [
        {
            key: "name",
            header: "Customer Name",
            render: (value: any) => <span className="font-medium text-gray-900">{value}</span>,
        },
        {
            key: "totalCredit",
            header: "Total Cash-In",
            render: (value: any) => (
                <span className="text-green-600 font-mono">
                    Rs. {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            key: "totalDebit",
            header: "Total Cash-Out",
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
                <span className={`font-bold font-mono ${Number(value) > 0 ? "text-red-700" : "text-green-700"}`}>
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
