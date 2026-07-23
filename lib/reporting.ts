import type { Case, CaseTask, Payment, PaymentType } from "@/types/domain";

export interface DateRange {
  from: string;
  to: string;
}

export interface FinanceSummary {
  received: number;
  spent: number;
  netCashflow: number;
}

export function currentMonthRange(isoDate: string): DateRange {
  const [year, month] = isoDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function isInDateRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function summarizeFinance(payments: Payment[]): FinanceSummary {
  return payments.reduce<FinanceSummary>(
    (summary, payment) => {
      if (payment.paymentType === "Thu") summary.received += payment.amount;
      if (payment.paymentType === "Chi") summary.spent += payment.amount;
      return summary;
    },
    { received: 0, spent: 0, netCashflow: 0 }
  );
}

export function financeSummary(payments: Payment[]): FinanceSummary {
  const summary = summarizeFinance(payments);
  return { ...summary, netCashflow: summary.received - summary.spent };
}

export function paymentsByType(payments: Payment[], paymentType: PaymentType | "all"): Payment[] {
  return paymentType === "all" ? payments : payments.filter((payment) => payment.paymentType === paymentType);
}

export function countCasesByStatus(cases: Case[]): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>();
  cases.forEach((caseItem) => counts.set(caseItem.status, (counts.get(caseItem.status) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((first, second) => second.count - first.count || first.status.localeCompare(second.status, "vi"));
}

export function countTasksByStatus(tasks: CaseTask[]): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>();
  tasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((first, second) => second.count - first.count || first.status.localeCompare(second.status, "vi"));
}
