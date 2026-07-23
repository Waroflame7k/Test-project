"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, ReceiptText, WalletCards } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { formatDate, todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { receivableForCase } from "@/lib/case-utils";
import { currentMonthRange, financeSummary, isInDateRange } from "@/lib/reporting";
import { can } from "@/lib/permissions";
import type { PaymentType } from "@/types/domain";

type PaymentFilter = PaymentType | "all";

const PAYMENT_FILTERS: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "Thu", label: "Khoản thu" },
  { value: "Chi", label: "Khoản chi" },
];

function paymentTone(paymentType: PaymentType) {
  if (paymentType === "Thu") return "bg-emerald-50 text-emerald-700";
  return "bg-rose-50 text-rose-700";
}

export function FinanceScreen() {
  const { data, navigate, screenParams, addPayment, addActivityLog } = useApp();
  const currentUser = useCurrentUser();
  const today = todayIso();
  const defaultRange = currentMonthRange(today);
  const [from, setFrom] = useState(
    typeof screenParams.rangeFrom === "string" ? screenParams.rangeFrom : defaultRange.from
  );
  const [to, setTo] = useState(typeof screenParams.rangeTo === "string" ? screenParams.rangeTo : defaultRange.to);
  const [paymentType, setPaymentType] = useState<PaymentFilter>("all");
  const [query, setQuery] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const scopedCaseId = typeof screenParams.caseId === "string" ? screenParams.caseId : "";
  const scopedCase = data.cases.find((caseItem) => caseItem.id === scopedCaseId);

  const canViewFinance = can(currentUser.role, "view_finance");
  const canEditFinance = can(currentUser.role, "edit_finance");

  const payments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.payments
      .filter((payment) => isInDateRange(payment.paymentDate, { from, to }))
      .filter((payment) => !scopedCaseId || payment.caseId === scopedCaseId)
      .filter((payment) => paymentType === "all" || payment.paymentType === paymentType)
      .filter((payment) => {
        if (!normalizedQuery) return true;
        const caseItem = data.cases.find((item) => item.id === payment.caseId);
        const customer = data.customers.find((item) => item.id === caseItem?.customerId);
        return [payment.category, payment.payer, payment.receiver, caseItem?.caseCode, customer?.fullName]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((first, second) => second.paymentDate.localeCompare(first.paymentDate));
  }, [data.cases, data.customers, data.payments, from, paymentType, query, scopedCaseId, to]);

  const summary = useMemo(() => financeSummary(payments), [payments]);
  const outstandingReceivable = useMemo(
    () => data.cases.filter((caseItem) => !caseItem.archivedAt).reduce((sum, caseItem) => sum + receivableForCase(caseItem, data.payments), 0),
    [data.cases, data.payments]
  );

  if (!canViewFinance) {
    return <EmptyState title="Không có quyền xem thu chi" message="Chức năng này dành cho quản trị và kế toán." />;
  }

  return (
    <div className="space-y-4 pb-6 md:space-y-6">
      <section className="luxe-panel-strong rounded-[1.5rem] p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Quản trị tài chính</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">Thu chi hồ sơ</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">Theo dõi khoản thu, chi và số tiền khách còn cần thanh toán theo từng hồ sơ. Giao dịch ghi trong hồ sơ tự xuất hiện tại đây.</p>
          </div>
          {canEditFinance ? (
            <button
              type="button"
              onClick={() => setEntryOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold luxe-button-primary"
            >
              <Plus size={17} /> Ghi nhận giao dịch
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Tổng thu" value={formatVnd(summary.received)} tone="text-emerald-700" icon={<ArrowDownLeft size={18} />} />
          <SummaryCard label="Tổng chi" value={formatVnd(summary.spent)} tone="text-rose-700" icon={<ArrowUpRight size={18} />} />
          <SummaryCard label="Dòng tiền thuần" value={formatVnd(summary.netCashflow)} tone="text-[var(--gold-700)]" icon={<WalletCards size={18} />} />
          <SummaryCard label="Còn phải thu" value={formatVnd(outstandingReceivable)} tone="text-[#b15c45]" icon={<ReceiptText size={18} />} />
        </div>
      </section>

      <section className="luxe-panel rounded-[1.5rem] p-3 md:p-5">
        {scopedCase ? <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-[rgba(255,245,220,0.8)] px-3 py-2 text-xs"><p className="font-bold text-[var(--text-main)]">Đang xem giao dịch: {scopedCase.caseCode}</p><button type="button" onClick={() => navigate("finance")} className="font-bold text-[var(--gold-700)]">Xem tất cả</button></div> : null}
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.3fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Từ ngày</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Đến ngày</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Tìm giao dịch</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Khách hàng, mã hồ sơ, nội dung..."
              className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {PAYMENT_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setPaymentType(filter.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                paymentType === filter.value ? "luxe-button-primary" : "luxe-button-secondary"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="luxe-panel overflow-hidden rounded-[1.5rem]">
        <div className="border-b luxe-divider px-4 py-3 md:px-5">
          <p className="text-sm font-bold text-[var(--text-main)]">{payments.length} giao dịch</p>
        </div>
        {payments.length === 0 ? (
          <div className="p-4"><EmptyState title="Chưa có giao dịch phù hợp" message="Thử thay đổi bộ lọc thời gian hoặc ghi nhận một giao dịch mới." /></div>
        ) : (
          <>
            <div className="divide-y divide-[rgba(198,152,53,0.1)] md:hidden">
              {payments.map((payment) => {
                const caseItem = data.cases.find((item) => item.id === payment.caseId);
                const customer = data.customers.find((item) => item.id === caseItem?.customerId);
                return (
                  <button key={payment.id} onClick={() => navigate("case-detail", { caseId: payment.caseId })} className="w-full p-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--text-main)]">{customer?.fullName ?? "Chưa xác định"}</p>
                        <p className="mt-1 truncate text-xs text-[var(--text-soft)]">{payment.category} · {caseItem?.caseCode ?? "Không có mã"}</p>
                      </div>
                      <p className={`shrink-0 text-sm font-black ${payment.paymentType === "Thu" ? "text-emerald-700" : "text-rose-700"}`}>
                        {payment.paymentType === "Thu" ? "+" : "-"}{formatVnd(payment.amount)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-faint)]">{formatDate(payment.paymentDate)} · {payment.paymentMethod}</p>
                  </button>
                );
              })}
            </div>
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-[rgba(251,246,236,0.7)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                <tr>
                  <th className="px-5 py-3">Ngày</th><th className="px-5 py-3">Hồ sơ / khách hàng</th><th className="px-5 py-3">Nội dung</th><th className="px-5 py-3">Loại</th><th className="px-5 py-3 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(198,152,53,0.1)]">
                {payments.map((payment) => {
                  const caseItem = data.cases.find((item) => item.id === payment.caseId);
                  const customer = data.customers.find((item) => item.id === caseItem?.customerId);
                  return (
                    <tr key={payment.id} onClick={() => navigate("case-detail", { caseId: payment.caseId })} className="cursor-pointer transition hover:bg-[rgba(255,249,240,0.5)]">
                      <td className="px-5 py-3 text-[var(--text-soft)]">{formatDate(payment.paymentDate)}</td>
                      <td className="px-5 py-3"><p className="font-bold text-[var(--text-main)]">{customer?.fullName ?? "Chưa xác định"}</p><p className="mt-1 text-xs text-[var(--text-soft)]">{caseItem?.caseCode ?? "Không có mã"}</p></td>
                      <td className="px-5 py-3 text-[var(--text-main)]">{payment.category}</td>
                      <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${paymentTone(payment.paymentType)}`}>{payment.paymentType}</span></td>
                      <td className={`px-5 py-3 text-right font-black ${payment.paymentType === "Thu" ? "text-emerald-700" : "text-rose-700"}`}>{payment.paymentType === "Thu" ? "+" : "-"}{formatVnd(payment.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </section>

      <FinanceEntryModal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        cases={data.cases.filter((caseItem) => !caseItem.archivedAt)}
        customers={data.customers}
        onSubmit={(entry) => {
          const savedPayment = addPayment({ ...entry, createdBy: currentUser.id });
          addActivityLog({
            organizationId: currentUser.organizationId,
            caseId: entry.caseId,
            actorId: currentUser.id,
            action: "Ghi nhận thu chi",
            entityType: "payments",
            entityId: savedPayment.id,
            newValue: `${entry.paymentType} · ${entry.amount}`,
          });
          setEntryOpen(false);
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: React.ReactNode }) {
  return <div className="rounded-[1.2rem] border border-[rgba(198,152,53,0.14)] bg-white p-3"><div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${tone}`}>{icon}{label}</div><p className="mt-2 text-lg font-black text-[var(--text-main)]">{value}</p></div>;
}

function FinanceEntryModal({
  open,
  onClose,
  cases,
  customers,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  cases: Array<{ id: string; caseCode: string; customerId: string; serviceFee: number }>;
  customers: Array<{ id: string; fullName: string }>;
  onSubmit: (entry: { caseId: string; paymentType: PaymentType; category: string; amount: number; paymentDate: string; paymentMethod: "Tiền mặt" | "Chuyển khoản" | "Khác"; note?: string }) => void;
}) {
  const [caseId, setCaseId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("Thu");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<"Tiền mặt" | "Chuyển khoản" | "Khác">("Tiền mặt");
  const [note, setNote] = useState("");
  const selectedCase = cases.find((caseItem) => caseItem.id === caseId);

  function submit() {
    const numericAmount = Number(amount.replaceAll(",", ""));
    if (!caseId || !category.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    onSubmit({ caseId, paymentType, category: category.trim(), amount: numericAmount, paymentDate, paymentMethod, note: note.trim() || undefined });
  }

  return (
    <Modal open={open} onClose={onClose} title="Ghi nhận thu chi">
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Hồ sơ</span><select value={caseId} onChange={(event) => setCaseId(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"><option value="">Chọn hồ sơ</option>{cases.map((caseItem) => <option key={caseItem.id} value={caseItem.id}>{caseItem.caseCode} · {customers.find((customer) => customer.id === caseItem.customerId)?.fullName ?? "Chưa xác định"}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">{(["Thu", "Chi"] as PaymentType[]).map((type) => <button key={type} type="button" onClick={() => setPaymentType(type)} className={`rounded-xl px-2 py-2 text-xs font-bold ${paymentType === type ? "luxe-button-primary" : "luxe-button-secondary"}`}>{type}</button>)}</div>
        {paymentType === "Thu" && selectedCase ? <button type="button" onClick={() => { setCategory("Phí dịch vụ"); setAmount(String(selectedCase.serviceFee)); }} className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left text-sm font-bold text-emerald-800"><span>Điền phí dịch vụ hồ sơ</span><span>{formatVnd(selectedCase.serviceFee)}</span></button> : null}
        <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Nội dung</span><input value={category} onChange={(event) => setCategory(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Số tiền</span><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Ngày giao dịch</span><input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Phương thức</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"><option>Tiền mặt</option><option>Chuyển khoản</option><option>Khác</option></select></label></div>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Ghi chú</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></label>
        <button type="button" onClick={submit} className="w-full rounded-xl py-3 text-sm font-bold luxe-button-primary">Lưu giao dịch</button>
      </div>
    </Modal>
  );
}
