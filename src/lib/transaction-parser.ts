/**
 * Shared transaction note parsing utilities.
 *
 * Ledger entries store structured metadata in a multi-line note format:
 *   Order #123
 *   Customer: John Doe
 *   Phone: 03001234567
 *   Address: 123 Main St
 *   Payment: Cash
 *   Item: [Stock] Widget (Qty: 5 pc @100)
 *   Advance: 500
 *   Remaining: 0
 *
 * This module is the SINGLE source of truth for parsing that format.
 * Used by: LedgerTable, LedgerPendingTable, LedgerEntryForm, receipt pages.
 */

import { REGEX } from "./constants";

export interface TransactionParsed {
    orderNumber: string;
    title: string;         // Customer or Supplier name
    itemName: string;
    quantity: number | null;
    unitPrice: number | null;
    isStructured: boolean;
    itemType: string | null;
    advance: number | undefined;
    remaining: number | undefined;
}

export interface ReceiptParsed extends TransactionParsed {
    customerPhone: string;
    customerAddress: string;
    paymentType: string;
}

/**
 * Parse a ledger entry note into structured fields for table display.
 */
export function parseTransactionNote(note: string | null): TransactionParsed {
    const empty: TransactionParsed = {
        orderNumber: "-", title: "-", itemName: "-",
        quantity: null, unitPrice: null,
        isStructured: false, itemType: null,
        advance: undefined, remaining: undefined,
    };
    if (!note) return empty;

    const lines = note.split("\n");
    let orderNumber = "";
    let title = "";
    let itemName = "";
    let quantity: number | null = null;
    let unitPrice: number | null = null;
    let isStructured = false;
    let itemType: string | null = null;
    let advance: number | undefined = undefined;
    let remaining: number | undefined = undefined;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("Order #")) {
            orderNumber = trimmed.replace("Order #", "").trim();
            isStructured = true;
        } else if (trimmed.startsWith("Customer: ")) {
            title = trimmed.replace("Customer: ", "").trim();
            isStructured = true;
        } else if (trimmed.startsWith("Supplier: ")) {
            title = trimmed.replace("Supplier: ", "").trim();
            isStructured = true;
        } else if (trimmed.startsWith("Item: ")) {
            isStructured = true;
            const match = trimmed.match(REGEX.ITEM_LINE);
            if (match) {
                itemType = match[1] || null;
                itemName = match[2].trim();
                quantity = Number(match[3]);
                unitPrice = Number(match[4]);
            } else {
                itemName = trimmed.replace("Item: ", "").trim();
            }
        } else if (trimmed.startsWith("Details: ")) {
            isStructured = true;
            itemName = trimmed.replace("Details: ", "").trim();
        }

        // Advance/Payment amount
        const advMatch = trimmed.match(REGEX.ADVANCE_OR_PAYMENT);
        if (advMatch) advance = Number(advMatch[2]);

        // Remaining balance
        const remMatch = trimmed.match(REGEX.REMAINING);
        if (remMatch) remaining = Number(remMatch[1]);
    }

    // Fallback for virtual entries (loans, bills, expenses)
    if (!isStructured) {
        if (note.startsWith("[Loan] ") || note.startsWith("[Payment] ")) {
            const nameMatch = note.match(/^\[(Loan|Payment)\] (.*?):/);
            if (nameMatch) {
                title = nameMatch[2].trim();
                itemName = note.replace(nameMatch[0], "").trim();
            }
            if (!itemName) itemName = note.startsWith("[Payment]") ? "Loan Repayment" : "Loan Given";
        } else if (note.startsWith("[Bill] ")) {
            const content = note.replace("[Bill] ", "").trim();
            const sep = content.lastIndexOf(" - ");
            if (sep !== -1) {
                title = content.substring(0, sep).trim();
                itemName = content.substring(sep + 3).trim();
            } else {
                title = content;
                itemName = "Utility Bill";
            }
        } else if (note.startsWith("[Expense] ")) {
            const content = note.replace("[Expense] ", "").trim();
            const sep = content.lastIndexOf(" - ");
            if (sep !== -1) {
                title = content.substring(0, sep).trim();
                itemName = content.substring(sep + 3).trim();
            } else {
                title = content;
                itemName = "Expense";
            }
        } else {
            title = "-";
            itemName = note;
        }
    }

    return {
        orderNumber: orderNumber || "-",
        title: title || "-",
        itemName: itemName || "-",
        quantity,
        unitPrice,
        isStructured,
        itemType,
        advance,
        remaining,
    };
}

/**
 * Extended parsing for receipt pages — includes phone, address, payment method.
 */
export function parseReceiptNote(note: string): ReceiptParsed {
    const base = parseTransactionNote(note);
    let customerPhone = "";
    let customerAddress = "";
    let paymentType = "Cash";

    for (const line of (note || "").split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("Phone: ")) customerPhone = trimmed.replace("Phone: ", "").trim();
        else if (trimmed.startsWith("Address: ")) customerAddress = trimmed.replace("Address: ", "").trim();

        const amountMatch = trimmed.match(/^(Advance|Payment|Adjustment):\s*([\d.]+(?!\s*[a-zA-Z]))/i);
        if (amountMatch) base.advance = Number(amountMatch[2]);

        const methodMatch = trimmed.match(REGEX.PAYMENT_METHOD);
        if (methodMatch) paymentType = methodMatch[1].trim();
    }

    return { ...base, customerPhone, customerAddress, paymentType };
}

/**
 * Simplified parsing for the pending payments table — only needs name, advance, remaining.
 */
export function parsePendingDetails(note: string | null) {
    if (!note) return { orderNumber: "-", title: "-", itemName: "-", advance: undefined as number | undefined, remaining: undefined as number | undefined };

    const base = parseTransactionNote(note);
    return {
        orderNumber: base.orderNumber,
        title: base.title,
        itemName: base.itemName,
        advance: base.advance,
        remaining: base.remaining,
    };
}
