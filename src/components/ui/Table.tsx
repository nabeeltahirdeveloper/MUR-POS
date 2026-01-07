import React from 'react';

interface Column<T> {
    key: keyof T | string;
    header: React.ReactNode;
    render?: (value: T[keyof T], row: T, index: number) => React.ReactNode;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    emptyMessage?: string;
}

export function Table<T extends Record<string, any> = Record<string, unknown>>({
    data,
    columns,
    emptyMessage = 'No data available',
}: TableProps<T>) {
    if (data.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                {emptyMessage}
            </div>
        );
    }

    const getValue = (row: T, key: string): unknown => {
        const keys = key.split('.');
        let value: unknown = row;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = (value as Record<string, unknown>)[k];
            } else {
                return undefined;
            }
        }
        return value;
    };

    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={String(column.key)}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                            {columns.map((column) => {
                                const value = getValue(row, String(column.key));
                                return (
                                    <td
                                        key={String(column.key)}
                                        className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                                    >
                                        {column.render
                                            ? column.render(value as T[keyof T], row, rowIndex)
                                            : formatValue(value)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function formatValue(value: unknown): React.ReactNode {
    if (value === null || value === undefined) {
        return <span className="text-gray-400">—</span>;
    }
    if (typeof value === 'boolean') {
        return value ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Yes
            </span>
        ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                No
            </span>
        );
    }
    if (value instanceof Date) {
        return value.toLocaleDateString();
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}
