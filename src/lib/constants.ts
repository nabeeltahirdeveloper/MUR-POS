/**
 * Centralized constants for the Moon-Traders application.
 * All regex patterns, default values, and magic numbers in one place.
 */

// --- Regex patterns used for parsing ledger note text ---
export const REGEX = {
    ORDER_NUMBER: /Order #(\d+)/,
    SUPPLIER: /Supplier:\s*([^\n]+)/,
    CUSTOMER: /Customer:\s*([^\n]+)/,
    REMAINING: /Remaining:\s*(\d+(\.\d+)?)/i,
    ADVANCE: /^(Advance|Payment|Paid):\s*(\d+(\.\d+)?)/i,
    ADVANCE_OR_PAYMENT: /^(Advance|Payment|Adjustment):\s*([\d.]+)/i,
    PAYMENT_METHOD: /^Payment:\s*([a-zA-Z\s]+)$/i,
    ITEM_LINE: /Item:\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*\(Qty:\s*([\d.]+).*?@\s*([^)]*)\)/,
    DIRECT_PAYMENT: /Direct Payment/i,
    UTILITY_PREFIX: /^Utility payment:/,
} as const;

// --- Pagination & query defaults ---
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 50,
    SAFE_LIMIT: 500,
} as const;

// --- Cache TTLs (in milliseconds) ---
export const CACHE_TTL = {
    SUPPLIER_BALANCE: 30_000,     // 30 seconds
    CUSTOMER_BALANCE: 30_000,
    STATS_BALANCE: 60_000,        // 1 minute
    DAILY_SUMMARY: 5 * 60_000,    // 5 minutes
    DASHBOARD_STATS: 2 * 60_000,  // 2 minutes
    ITEM_CACHE: 5 * 60_000,       // 5 minutes
    SETTINGS: 60_000,             // 1 minute
} as const;

// --- Debounce values ---
export const DEBOUNCE = {
    DASHBOARD_REFRESH: 1500,
    SEARCH_INPUT: 300,
} as const;

// --- Status enums ---
export enum LedgerStatus {
    OPEN = "open",
    CLOSED = "closed",
}

export enum DebtStatus {
    ACTIVE = "active",
    PAID = "paid",
}

export enum DebtType {
    LOANED_IN = "loaned_in",
    LOANED_OUT = "loaned_out",
}

export enum BillStatus {
    PAID = "paid",
    UNPAID = "unpaid",
}
