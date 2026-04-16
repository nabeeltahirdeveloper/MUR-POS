/**
 * Consistent date handling utilities.
 * Replaces the 4+ different date patterns scattered across the codebase.
 */

/** Set time to 00:00:00.000 */
export function startOfDay(date: Date | string): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Set time to 23:59:59.999 */
export function endOfDay(date: Date | string): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

/** Format as YYYY-MM-DD */
export function formatYMD(date: Date | string): string {
    return new Date(date).toISOString().split("T")[0];
}

/** Safely convert any date-like value to a JS Date */
export function toDateSafe(val: any): Date {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    if (typeof val.toDate === "function") return val.toDate();
    return new Date(val);
}
