export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(amount);
}

export function calculateReceivable(serviceFee: number, paidAmount: number): number {
  return Math.max(serviceFee - paidAmount, 0);
}
