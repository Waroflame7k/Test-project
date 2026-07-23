import type { AppData } from "@/types/domain";

// Convert the retired payment type as data is loaded, so old records remain usable.
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    payments: data.payments.map((payment) =>
      (payment.paymentType as string) === "Chi hộ"
        ? { ...payment, paymentType: "Chi" }
        : payment
    ),
  };
}
