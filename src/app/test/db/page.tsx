'use client';

import { useState } from 'react';
import { Button, Table, LoadingSpinner, ErrorDisplay, EmptyState } from '@/components/ui';

type TestSection = 'reference' | 'items' | 'stock' | 'purchase-orders' | 'ledger' | 'utilities' | 'debts' | 'reminders';

interface ApiResponse {
    success: boolean;
    data?: unknown;
    error?: string;
}

export default function DatabaseTestPage() {
    const [activeSection, setActiveSection] = useState<TestSection>('reference');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<unknown>(null);
    const [actionResult, setActionResult] = useState<string | null>(null);

    const fetchData = async (endpoint: string) => {
        setLoading(true);
        setError(null);
        setActionResult(null);
        try {
            const response = await fetch(`/api/test/${endpoint}`);
            const result: ApiResponse = await response.json();
            if (result.success) {
                setData(result.data);
            } else {
                setError(result.error || 'Unknown error');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const postData = async (endpoint: string, body: object) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/test/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result: ApiResponse = await response.json();
            if (result.success) {
                setActionResult(`Created successfully: ${JSON.stringify(result.data, null, 2)}`);
                // Refresh data
                await fetchData(endpoint);
            } else {
                setError(result.error || 'Unknown error');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create data');
        } finally {
            setLoading(false);
        }
    };

    const sections: { id: TestSection; label: string }[] = [
        { id: 'reference', label: 'Reference Data' },
        { id: 'items', label: 'Items' },
        { id: 'stock', label: 'Stock Logs' },
        { id: 'purchase-orders', label: 'Purchase Orders' },
        { id: 'ledger', label: 'Ledger' },
        { id: 'utilities', label: 'Utilities' },
        { id: 'debts', label: 'Debts' },
        { id: 'reminders', label: 'Reminders' },
    ];

    const handleSectionChange = (section: TestSection) => {
        setActiveSection(section);
        setData(null);
        setError(null);
        setActionResult(null);
    };

    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Database Testing Dashboard</h1>
                    <p className="text-gray-600">
                        Use this page to test and validate database operations. This is a development tool.
                    </p>
                </div>

                {/* Section Tabs */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                        {sections.map((section) => (
                            <Button
                                key={section.id}
                                variant={activeSection === section.id ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => handleSectionChange(section.id)}
                            >
                                {section.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    {activeSection === 'reference' && (
                        <ReferenceSection
                            data={data as ReferenceData}
                            loading={loading}
                            error={error}
                            onFetch={() => fetchData('reference')}
                        />
                    )}
                    {activeSection === 'items' && (
                        <ItemsSection
                            data={data as ItemsData}
                            loading={loading}
                            error={error}
                            actionResult={actionResult}
                            onFetch={() => fetchData('items')}
                            onCreate={(itemData) => postData('items', itemData)}
                        />
                    )}
                    {activeSection === 'stock' && (
                        <StockSection
                            data={data as StockData}
                            loading={loading}
                            error={error}
                            actionResult={actionResult}
                            onFetch={() => fetchData('stock')}
                            onCreate={(stockData) => postData('stock', stockData)}
                        />
                    )}
                    {activeSection === 'purchase-orders' && (
                        <PurchaseOrdersSection
                            data={data as PurchaseOrderData}
                            loading={loading}
                            error={error}
                            actionResult={actionResult}
                            onFetch={() => fetchData('purchase-orders')}
                            onCreate={(poData) => postData('purchase-orders', poData)}
                        />
                    )}
                    {activeSection === 'ledger' && (
                        <LedgerSection
                            data={data as LedgerData}
                            loading={loading}
                            error={error}
                            actionResult={actionResult}
                            onFetch={() => fetchData('ledger')}
                            onCreate={(ledgerData) => postData('ledger', ledgerData)}
                        />
                    )}
                    {activeSection === 'utilities' && (
                        <UtilitiesSection
                            data={data as UtilitiesData}
                            loading={loading}
                            error={error}
                            actionResult={actionResult}
                            onFetch={() => fetchData('utilities')}
                            onCreate={(utilData) => postData('utilities', utilData)}
                        />
                    )}
                    {activeSection === 'debts' && (
                        <DebtsSection
                            data={data as DebtsData}
                            loading={loading}
                            error={error}
                            actionResult={actionResult}
                            onFetch={() => fetchData('debts')}
                            onCreate={(debtData) => postData('debts', debtData)}
                        />
                    )}
                    {activeSection === 'reminders' && (
                        <RemindersSection
                            data={data as RemindersData}
                            loading={loading}
                            error={error}
                            actionResult={actionResult}
                            onFetch={() => fetchData('reminders')}
                            onCreate={(reminderData) => postData('reminders', reminderData)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Type definitions
interface ReferenceData {
    units: Array<{ id: number; name: string; symbol?: string }>;
    categories: Array<{ id: number; name: string }>;
    ledgerCategories: Array<{ id: number; name: string }>;
    suppliers: Array<{ id: number; name: string; phone?: string }>;
}

interface ItemsData {
    items: Array<{
        id: number;
        name: string;
        category?: { name: string };
        baseUnit?: { name: string };
        currentStock: number;
        isLowStock: boolean;
    }>;
    totalCount: number;
    lowStockCount: number;
}

interface StockData {
    recentLogs: Array<{
        id: number;
        type: string;
        quantityBaseUnit: number;
        item: { name: string };
        createdAt: string;
    }>;
    lowStockItems: Array<{
        id: number;
        name: string;
        currentStock: number;
        minStockLevel: number;
    }>;
}

interface PurchaseOrderData extends Array<{
    id: number;
    status: string;
    totalAmount: number;
    supplier?: { name: string };
    items: Array<{ item: { name: string }; qty: number }>;
}> { }

interface LedgerData {
    entries: Array<{
        id: number;
        type: string;
        amount: number;
        category?: { name: string };
        note?: string;
        date: string;
    }>;
    summary: {
        totalCredits: number;
        totalDebits: number;
        balance: number;
    };
}

interface UtilitiesData {
    all: Array<{
        id: number;
        name: string;
        amount: number;
        dueDate: string;
        urgency: string;
        status?: string;
    }>;
    summary: {
        total: number;
        pendingCount: number;
        overdueCount: number;
        totalAmount: number;
    };
}

interface DebtsData {
    debts: Array<{
        id: number;
        personName: string;
        type: string;
        amount: number;
        balance: number;
        isPaidOff: boolean;
    }>;
    summary: {
        totalLoanedOut: number;
        totalLoanedIn: number;
        outstandingLoanedOut: number;
        outstandingLoanedIn: number;
    };
}

interface RemindersData {
    all: Array<{
        id: number;
        type: string;
        message?: string;
        triggered?: boolean;
    }>;
    summary: {
        total: number;
        pendingCount: number;
        triggeredCount: number;
    };
}

// Section Components
function ReferenceSection({
    data,
    loading,
    error,
    onFetch,
}: {
    data: ReferenceData | null;
    loading: boolean;
    error: string | null;
    onFetch: () => void;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Reference Data (Units, Categories, Suppliers)</h2>
                <Button onClick={onFetch} isLoading={loading}>
                    Fetch Data
                </Button>
            </div>

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading reference data..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Fetch Data' to load reference data" />
            )}

            {data && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-md font-medium mb-2">Units ({data.units?.length || 0})</h3>
                        <Table
                            data={data.units || []}
                            columns={[
                                { key: 'id', header: 'ID' },
                                { key: 'name', header: 'Name' },
                                { key: 'symbol', header: 'Symbol' },
                            ]}
                        />
                    </div>
                    <div>
                        <h3 className="text-md font-medium mb-2">Categories ({data.categories?.length || 0})</h3>
                        <Table
                            data={data.categories || []}
                            columns={[
                                { key: 'id', header: 'ID' },
                                { key: 'name', header: 'Name' },
                            ]}
                        />
                    </div>
                    <div>
                        <h3 className="text-md font-medium mb-2">Ledger Categories ({data.ledgerCategories?.length || 0})</h3>
                        <Table
                            data={data.ledgerCategories || []}
                            columns={[
                                { key: 'id', header: 'ID' },
                                { key: 'name', header: 'Name' },
                            ]}
                        />
                    </div>
                    <div>
                        <h3 className="text-md font-medium mb-2">Suppliers ({data.suppliers?.length || 0})</h3>
                        <Table
                            data={data.suppliers || []}
                            columns={[
                                { key: 'id', header: 'ID' },
                                { key: 'name', header: 'Name' },
                                { key: 'phone', header: 'Phone' },
                            ]}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ItemsSection({
    data,
    loading,
    error,
    actionResult,
    onFetch,
    onCreate,
}: {
    data: ItemsData | null;
    loading: boolean;
    error: string | null;
    actionResult: string | null;
    onFetch: () => void;
    onCreate: (data: object) => void;
}) {
    const createSampleItem = () => {
        onCreate({
            name: `Test Item ${Date.now()}`,
            categoryId: 1,
            baseUnitId: 1,
            minStockLevel: 10,
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Items</h2>
                <div className="flex gap-2">
                    <Button onClick={onFetch} isLoading={loading}>
                        Show Items
                    </Button>
                    <Button variant="success" onClick={createSampleItem} isLoading={loading}>
                        Create Sample Item
                    </Button>
                </div>
            </div>

            {actionResult && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <pre className="whitespace-pre-wrap">{actionResult}</pre>
                </div>
            )}

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading items..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Show Items' to load items" />
            )}

            {data && (
                <div>
                    <div className="mb-4 grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{data.totalCount}</div>
                            <div className="text-sm text-blue-800">Total Items</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{data.lowStockCount}</div>
                            <div className="text-sm text-red-800">Low Stock Items</div>
                        </div>
                    </div>
                    <Table
                        data={data.items || []}
                        columns={[
                            { key: 'id', header: 'ID' },
                            { key: 'name', header: 'Name' },
                            { key: 'category.name', header: 'Category' },
                            { key: 'baseUnit.name', header: 'Unit' },
                            { key: 'currentStock', header: 'Current Stock' },
                            {
                                key: 'isLowStock',
                                header: 'Status',
                                render: (value) => (
                                    <span className={`px-2 py-1 rounded text-xs ${value ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {value ? 'Low Stock' : 'OK'}
                                    </span>
                                ),
                            },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}

function StockSection({
    data,
    loading,
    error,
    actionResult,
    onFetch,
    onCreate,
}: {
    data: StockData | null;
    loading: boolean;
    error: string | null;
    actionResult: string | null;
    onFetch: () => void;
    onCreate: (data: object) => void;
}) {
    const createStockIn = () => {
        onCreate({
            itemId: 1,
            type: 'in',
            quantityBaseUnit: 50,
            description: 'Test stock in',
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Stock Logs</h2>
                <div className="flex gap-2">
                    <Button onClick={onFetch} isLoading={loading}>
                        Show Stock Logs
                    </Button>
                    <Button variant="success" onClick={createStockIn} isLoading={loading}>
                        Add Stock (Item #1)
                    </Button>
                </div>
            </div>

            {actionResult && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <pre className="whitespace-pre-wrap">{actionResult}</pre>
                </div>
            )}

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading stock logs..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Show Stock Logs' to load data" />
            )}

            {data && (
                <div className="space-y-6">
                    {data.lowStockItems && data.lowStockItems.length > 0 && (
                        <div>
                            <h3 className="text-md font-medium mb-2 text-red-600">⚠️ Low Stock Items</h3>
                            <Table
                                data={data.lowStockItems}
                                columns={[
                                    { key: 'name', header: 'Item' },
                                    { key: 'currentStock', header: 'Current' },
                                    { key: 'minStockLevel', header: 'Min Level' },
                                    { key: 'unit', header: 'Unit' },
                                ]}
                            />
                        </div>
                    )}
                    <div>
                        <h3 className="text-md font-medium mb-2">Recent Stock Logs</h3>
                        <Table
                            data={data.recentLogs || []}
                            columns={[
                                { key: 'id', header: 'ID' },
                                { key: 'item.name', header: 'Item' },
                                {
                                    key: 'type',
                                    header: 'Type',
                                    render: (value) => (
                                        <span className={`px-2 py-1 rounded text-xs ${value === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {value === 'in' ? '↑ IN' : '↓ OUT'}
                                        </span>
                                    ),
                                },
                                { key: 'quantityBaseUnit', header: 'Quantity' },
                                { key: 'createdAt', header: 'Date' },
                            ]}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function PurchaseOrdersSection({
    data,
    loading,
    error,
    actionResult,
    onFetch,
    onCreate,
}: {
    data: PurchaseOrderData | null;
    loading: boolean;
    error: string | null;
    actionResult: string | null;
    onFetch: () => void;
    onCreate: (data: object) => void;
}) {
    const createSamplePO = () => {
        onCreate({
            supplierId: 1,
            status: 'pending',
            items: [
                { itemId: 1, qty: 10, pricePerUnit: 100 },
            ],
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Purchase Orders</h2>
                <div className="flex gap-2">
                    <Button onClick={onFetch} isLoading={loading}>
                        Show Purchase Orders
                    </Button>
                    <Button variant="success" onClick={createSamplePO} isLoading={loading}>
                        Create Sample PO
                    </Button>
                </div>
            </div>

            {actionResult && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <pre className="whitespace-pre-wrap">{actionResult}</pre>
                </div>
            )}

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading purchase orders..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Show Purchase Orders' to load data" />
            )}

            {data && Array.isArray(data) && (
                <Table
                    data={data}
                    columns={[
                        { key: 'id', header: 'ID' },
                        { key: 'supplier.name', header: 'Supplier' },
                        { key: 'status', header: 'Status' },
                        { key: 'totalAmount', header: 'Total Amount' },
                        {
                            key: 'items',
                            header: 'Items',
                            render: (value) => {
                                const items = value as Array<{ item: { name: string }; qty: number }>;
                                return items?.length || 0;
                            },
                        },
                    ]}
                />
            )}
        </div>
    );
}

function LedgerSection({
    data,
    loading,
    error,
    actionResult,
    onFetch,
    onCreate,
}: {
    data: LedgerData | null;
    loading: boolean;
    error: string | null;
    actionResult: string | null;
    onFetch: () => void;
    onCreate: (data: object) => void;
}) {
    const createLedgerEntry = () => {
        onCreate({
            type: 'credit',
            amount: 1000,
            categoryId: 1,
            note: 'Test income entry',
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Ledger</h2>
                <div className="flex gap-2">
                    <Button onClick={onFetch} isLoading={loading}>
                        Show Ledger
                    </Button>
                    <Button variant="success" onClick={createLedgerEntry} isLoading={loading}>
                        Add Credit Entry
                    </Button>
                </div>
            </div>

            {actionResult && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <pre className="whitespace-pre-wrap">{actionResult}</pre>
                </div>
            )}

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading ledger..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Show Ledger' to load data" />
            )}

            {data && (
                <div>
                    <div className="mb-4 grid grid-cols-3 gap-4">
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">
                                ${data.summary?.totalCredits?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-green-800">Total Credits</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">
                                ${data.summary?.totalDebits?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-red-800">Total Debits</div>
                        </div>
                        <div className={`p-4 rounded-lg ${(data.summary?.balance || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                            <div className={`text-2xl font-bold ${(data.summary?.balance || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                ${data.summary?.balance?.toFixed(2) || '0.00'}
                            </div>
                            <div className={`text-sm ${(data.summary?.balance || 0) >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Balance</div>
                        </div>
                    </div>
                    <Table
                        data={data.entries || []}
                        columns={[
                            { key: 'id', header: 'ID' },
                            {
                                key: 'type',
                                header: 'Type',
                                render: (value) => (
                                    <span className={`px-2 py-1 rounded text-xs ${value === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {String(value).toUpperCase()}
                                    </span>
                                ),
                            },
                            { key: 'amount', header: 'Amount' },
                            { key: 'category.name', header: 'Category' },
                            { key: 'note', header: 'Note' },
                            { key: 'date', header: 'Date' },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}

function UtilitiesSection({
    data,
    loading,
    error,
    actionResult,
    onFetch,
    onCreate,
}: {
    data: UtilitiesData | null;
    loading: boolean;
    error: string | null;
    actionResult: string | null;
    onFetch: () => void;
    onCreate: (data: object) => void;
}) {
    const createUtility = () => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        onCreate({
            name: 'Electric Bill',
            amount: 150,
            dueDate: dueDate.toISOString(),
            category: 'electricity',
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Utilities</h2>
                <div className="flex gap-2">
                    <Button onClick={onFetch} isLoading={loading}>
                        Show Utilities
                    </Button>
                    <Button variant="success" onClick={createUtility} isLoading={loading}>
                        Add Utility Bill
                    </Button>
                </div>
            </div>

            {actionResult && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <pre className="whitespace-pre-wrap">{actionResult}</pre>
                </div>
            )}

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading utilities..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Show Utilities' to load data" />
            )}

            {data && (
                <div>
                    <div className="mb-4 grid grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{data.summary?.total || 0}</div>
                            <div className="text-sm text-blue-800">Total Bills</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{data.summary?.pendingCount || 0}</div>
                            <div className="text-sm text-yellow-800">Pending</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{data.summary?.overdueCount || 0}</div>
                            <div className="text-sm text-red-800">Overdue</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">
                                ${data.summary?.totalAmount?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-purple-800">Total Amount</div>
                        </div>
                    </div>
                    <Table
                        data={data.all || []}
                        columns={[
                            { key: 'id', header: 'ID' },
                            { key: 'name', header: 'Name' },
                            { key: 'amount', header: 'Amount' },
                            { key: 'dueDate', header: 'Due Date' },
                            {
                                key: 'urgency',
                                header: 'Urgency',
                                render: (value) => {
                                    const colors: Record<string, string> = {
                                        overdue: 'bg-red-100 text-red-800',
                                        urgent: 'bg-orange-100 text-orange-800',
                                        warning: 'bg-yellow-100 text-yellow-800',
                                        normal: 'bg-green-100 text-green-800',
                                    };
                                    return (
                                        <span className={`px-2 py-1 rounded text-xs ${colors[value as string] || colors.normal}`}>
                                            {String(value).toUpperCase()}
                                        </span>
                                    );
                                },
                            },
                            { key: 'status', header: 'Status' },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}

function DebtsSection({
    data,
    loading,
    error,
    actionResult,
    onFetch,
    onCreate,
}: {
    data: DebtsData | null;
    loading: boolean;
    error: string | null;
    actionResult: string | null;
    onFetch: () => void;
    onCreate: (data: object) => void;
}) {
    const createDebt = () => {
        onCreate({
            personName: 'John Doe',
            type: 'loaned_out',
            amount: 500,
            note: 'Test loan',
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Debts & Loans</h2>
                <div className="flex gap-2">
                    <Button onClick={onFetch} isLoading={loading}>
                        Show Debts
                    </Button>
                    <Button variant="success" onClick={createDebt} isLoading={loading}>
                        Add Debt
                    </Button>
                </div>
            </div>

            {actionResult && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <pre className="whitespace-pre-wrap">{actionResult}</pre>
                </div>
            )}

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading debts..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Show Debts' to load data" />
            )}

            {data && (
                <div>
                    <div className="mb-4 grid grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                                ${data.summary?.totalLoanedOut?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-blue-800">Loaned Out</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">
                                ${data.summary?.outstandingLoanedOut?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-orange-800">Outstanding (Out)</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">
                                ${data.summary?.totalLoanedIn?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-purple-800">Loaned In</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">
                                ${data.summary?.outstandingLoanedIn?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-red-800">Outstanding (In)</div>
                        </div>
                    </div>
                    <Table
                        data={data.debts || []}
                        columns={[
                            { key: 'id', header: 'ID' },
                            { key: 'personName', header: 'Person' },
                            {
                                key: 'type',
                                header: 'Type',
                                render: (value) => (
                                    <span className={`px-2 py-1 rounded text-xs ${value === 'loaned_out' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                        {value === 'loaned_out' ? '↗ OUT' : '↙ IN'}
                                    </span>
                                ),
                            },
                            { key: 'amount', header: 'Amount' },
                            { key: 'balance', header: 'Balance' },
                            {
                                key: 'isPaidOff',
                                header: 'Status',
                                render: (value) => (
                                    <span className={`px-2 py-1 rounded text-xs ${value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {value ? 'Paid Off' : 'Outstanding'}
                                    </span>
                                ),
                            },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}

function RemindersSection({
    data,
    loading,
    error,
    actionResult,
    onFetch,
    onCreate,
}: {
    data: RemindersData | null;
    loading: boolean;
    error: string | null;
    actionResult: string | null;
    onFetch: () => void;
    onCreate: (data: object) => void;
}) {
    const createReminder = () => {
        onCreate({
            type: 'low_stock',
            message: 'Test reminder - Low stock alert',
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Reminders</h2>
                <div className="flex gap-2">
                    <Button onClick={onFetch} isLoading={loading}>
                        Show Reminders
                    </Button>
                    <Button variant="success" onClick={createReminder} isLoading={loading}>
                        Add Reminder
                    </Button>
                </div>
            </div>

            {actionResult && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <pre className="whitespace-pre-wrap">{actionResult}</pre>
                </div>
            )}

            {error && <ErrorDisplay message={error} onRetry={onFetch} />}
            {loading && <LoadingSpinner message="Loading reminders..." />}

            {!loading && !error && !data && (
                <EmptyState message="Click 'Show Reminders' to load data" />
            )}

            {data && (
                <div>
                    <div className="mb-4 grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{data.summary?.total || 0}</div>
                            <div className="text-sm text-blue-800">Total Reminders</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{data.summary?.pendingCount || 0}</div>
                            <div className="text-sm text-yellow-800">Pending</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{data.summary?.triggeredCount || 0}</div>
                            <div className="text-sm text-green-800">Triggered</div>
                        </div>
                    </div>
                    <Table
                        data={data.all || []}
                        columns={[
                            { key: 'id', header: 'ID' },
                            {
                                key: 'type',
                                header: 'Type',
                                render: (value) => {
                                    const colors: Record<string, string> = {
                                        low_stock: 'bg-red-100 text-red-800',
                                        bill_due: 'bg-yellow-100 text-yellow-800',
                                        debt_due: 'bg-purple-100 text-purple-800',
                                    };
                                    return (
                                        <span className={`px-2 py-1 rounded text-xs ${colors[value as string] || 'bg-gray-100 text-gray-800'}`}>
                                            {String(value).replace('_', ' ').toUpperCase()}
                                        </span>
                                    );
                                },
                            },
                            { key: 'message', header: 'Message' },
                            {
                                key: 'triggered',
                                header: 'Status',
                                render: (value) => (
                                    <span className={`px-2 py-1 rounded text-xs ${value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {value ? 'Triggered' : 'Pending'}
                                    </span>
                                ),
                            },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}
