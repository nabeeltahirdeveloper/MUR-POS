/**
 * Firestore document type definitions based on Prisma schema
 * All integer IDs are converted to strings for Firestore
 */

export interface FirestoreUser {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date | any;
    emailVerified?: Date | null | any;
    image?: string | null;
}

export interface FirestoreUnit {
    id: string;
    name: string;
    symbol?: string | null;
    createdAt: Date | any;
}

export interface FirestoreUnitConversion {
    id: string;
    fromUnitId: string;
    toUnitId: string;
    factor: number;
    createdAt: Date | any;
}

export interface FirestoreCategory {
    id: string;
    name: string;
}

export interface FirestoreItem {
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
    createdAt: Date | any;
}

export interface FirestoreStockLog {
    id: string;
    itemId: string;
    type: 'in' | 'out';
    quantityBaseUnit: number;
    description?: string | null;
    createdAt: Date | any;
}

export interface FirestoreLedgerCategory {
    id: string;
    name: string;
}

export interface FirestoreLedger {
    id: string;
    type: 'debit' | 'credit';
    amount: number;
    categoryId?: string | null;
    note?: string | null;
    date: Date | any;
    createdAt: Date | any;
}

export interface FirestoreSupplier {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
}

export interface FirestoreCustomer {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
}

export interface FirestorePurchaseOrder {
    id: string;
    supplierId?: string | null;
    status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
    totalAmount?: number | null;
    notes?: string | null;
    terms?: string | null;
    createdAt: Date | any;
}

export interface FirestorePurchaseOrderItem {
    id: string;
    orderId: string;
    itemId: string;
    qty: number;
    pricePerUnit: number;
}

export interface FirestoreUtility {
    id: string;
    name: string;
    amount: number;
    dueDate: Date | any;
    paidAt?: Date | any; // Capture when the bill was paid
    category?: string | null;
    status: 'paid' | 'unpaid';
    createdAt: Date | any;
}

export interface FirestoreDebt {
    id: string;
    personName: string;
    type: 'loaned_out' | 'loaned_in';
    amount: number;
    dueDate?: Date | null | any;
    note?: string | null;
    status: 'active' | 'paid';
    createdAt: Date | any;
}

export interface FirestoreDebtPayment {
    id: string;
    debtId: string;
    amount: number;
    date: Date | any;
    note?: string | null;
}


export interface FirestoreReminder {
    id: string;
    type: 'low_stock' | 'bill_due' | 'debt_due';
    referenceId?: string | null;
    message?: string | null;
    triggered?: boolean | null;
    createdAt: Date | any;
}

export interface FirestoreSettings {
    id: string; // 'global'
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
    updatedAt: Date | any;
}

