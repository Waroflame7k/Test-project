import { TIME_ZONE } from "@/lib/constants";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function todayIso(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDate(iso?: string): string {
  if (!iso) return "-";
  return dateFormatter.format(parseIsoDate(iso));
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso).getTime();
  const to = parseIsoDate(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function daysUntil(dueIso: string, fromIso = todayIso()): number {
  return daysBetween(fromIso, dueIso);
}

export function isOverdue(dueIso: string, fromIso = todayIso()): boolean {
  return daysUntil(dueIso, fromIso) < 0;
}

export function isDueSoon(dueIso: string, fromIso = todayIso(), threshold = 5): boolean {
  const days = daysUntil(dueIso, fromIso);
  return days >= 0 && days <= threshold;
}

export function addDays(iso: string, days: number): string {
  const next = parseIsoDate(iso);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function dueText(dueIso: string, fromIso = todayIso()): string {
  const days = daysUntil(dueIso, fromIso);
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Đến hạn hôm nay";
  return `Còn ${days} ngày`;
}
