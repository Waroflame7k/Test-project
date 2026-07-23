import type { Case, CaseStatus, Payment } from "@/types/domain";
import { calculateReceivable } from "@/lib/money";

export function generateCaseCode(year: number, existingCodes: string[]): string {
  const prefix = `HS-${year}-`;
  const sequence = existingCodes
    .filter((code) => code.startsWith(prefix))
    .map((code) => Number(code.replace(prefix, "")))
    .filter(Number.isFinite);
  const next = (sequence.length ? Math.max(...sequence) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function isCaseActive(status: CaseStatus): boolean {
  return !["Hoàn tất", "Khách hủy"].includes(status);
}

export function paidByCustomer(caseId: string, payments: Payment[]): number {
  return payments
    .filter((payment) => payment.caseId === caseId && payment.paymentType === "Thu")
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function receivableForCase(caseItem: Case, payments: Payment[]): number {
  const spentForCase = payments
    .filter((payment) => payment.caseId === caseItem.id && payment.paymentType === "Chi")
    .reduce((sum, payment) => sum + payment.amount, 0);
  return calculateReceivable(caseItem.serviceFee + spentForCase, paidByCustomer(caseItem.id, payments));
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d+(\d{2})/, "$1****$2");
}
