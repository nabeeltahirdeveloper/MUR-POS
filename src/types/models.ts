/**
 * API/DTO type definitions for data returned by the data layer
 * (lib/prisma-helpers.ts). All numeric IDs from Prisma are converted
 * to strings for consistent API responses.
 */

export interface ApiUser {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date | string;
    emailVerified?: Date | string | null;
    image?: string | null;
}

export interface ApiUnit {
    id: string;
    name: string;
    symbol?: string | null;
    createdAt: Date | string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiUnitConversion {
    id: string;
    fromUnitId: string;
    toUnitId: string;
    factor: number;
    createdAt: Date | string;
}

export interface ApiCategory {
    id: string;
    name: string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiItem {
    id: string;
    name: string;
    categoryId?: string | null;
    baseUnitId?: string | null;
    saleUnitId?: string | null;
    conversionFactor?: number | null;
    minStockLevel?: number | null;
    firstSalePrice?: number | null;
    secondPurchasePrice?: number | null;
    supplierId?: string | null;
    orderNumber?: number | null;
    image?: string | null;
    description?: string | null;
    createdAt: Date | string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiStockLog {
    id: string;
    itemId: string;
    type: 'in' | 'out';
    quantityBaseUnit: number;
    description?: string | null;
    createdAt: Date | string;
}

export interface ApiLedgerCategory {
    id: string;
    name: string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiLedger {
    id: string;
    type: 'debit' | 'credit';
    amount: number;
    categoryId?: string | null;
    itemId?: string | null;
    quantity?: number | null;
    note?: string | null;
    orderNumber?: number | null;
    status?: 'open' | 'closed';
    date: Date | string;
    createdAt: Date | string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiSupplier {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiCustomer {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiPurchaseOrder {
    id: string;
    supplierId?: string | null;
    status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
    totalAmount?: number | null;
    notes?: string | null;
    terms?: string | null;
    createdAt: Date | string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiPurchaseOrderItem {
    id: string;
    orderId: string;
    itemId: string;
    qty: number;
    pricePerUnit: number;
}

export interface ApiExpense {
    id: string;
    name: string;
    amount: number;
    dueDate: Date | string;
    paidAt?: Date | string | null;
    category?: string | null;
    status: 'paid' | 'unpaid';
    createdAt: Date | string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiUtility {
    id: string;
    name: string;
    amount: number;
    dueDate: Date | string;
    paidAt?: Date | string | null;
    category?: string | null;
    status: 'paid' | 'unpaid';
    createdAt: Date | string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiDebt {
    id: string;
    personName: string;
    type: 'loaned_out' | 'loaned_in';
    amount: number;
    dueDate?: Date | string | null;
    note?: string | null;
    status: 'active' | 'paid';
    createdAt: Date | string;
    deletedAt?: Date | string | null;
    deletedBy?: string | null;
}

export interface ApiDebtPayment {
    id: string;
    debtId: string;
    amount: number;
    date: Date | string;
    note?: string | null;
}

export interface ApiReminder {
    id: string;
    type: 'low_stock' | 'bill_due' | 'debt_due';
    referenceId?: string | null;
    message?: string | null;
    triggered?: boolean | null;
    createdAt: Date | string;
}

export interface ApiSettings {
    id: string;
    businessProfile: {
        name: string;
        address?: string | null;
        phone?: string | null;
        email?: string | null;
        logoUrl?: string | null;
        tagline?: string | null;
    };
    currency: {
        symbol: string;
        code: string;
        position: 'prefix' | 'suffix';
    };
    inventory: {
        globalMinStockLevel: number;
        enableLowStockAlerts: boolean;
    };
    notifications: {
        emailEnabled: boolean;
        alertTypes: string[];
    };
    updatedAt: Date | string;
}
