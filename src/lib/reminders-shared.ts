export type ReminderType = "low_stock" | "bill_due" | "debt_due";
export type ReminderSourceCollection = "items" | "utilities" | "debts";
export type ReminderStatus = "triggered" | "pending" | "all";

export interface ReminderSourceRef {
  collection: ReminderSourceCollection;
  id: string;
}

export function reminderDocId(type: ReminderType, sourceId: string, suffix?: string | number): string {
  return suffix !== undefined ? `${type}:${sourceId}:${suffix}` : `${type}:${sourceId}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function computeDueTriggerAt(dueDate: Date, leadDays: number): Date {
  return addDays(startOfDay(dueDate), -leadDays);
}

export function reminderTypeLabel(type: ReminderType): string {
  if (type === "low_stock") return "Low stock";
  if (type === "bill_due") return "Bill due";
  if (type === "debt_due") return "Cash-Out due";
  return type;
}


