"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarCheck2, CircleDollarSign, ClipboardList, FileText, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { isDueSoon, isOverdue, todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { can } from "@/lib/permissions";
import { countCasesByStatus, countTasksByStatus, currentMonthRange, financeSummary, isInDateRange } from "@/lib/reporting";
import { visibleTasksForRole } from "@/lib/task-utils";

function ReportMetric({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: string }) {
  return <article className="luxe-card rounded-[1.4rem] p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</div><p className="mt-3 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--text-faint)]">{label}</p><p className="mt-1 text-2xl font-black text-[var(--text-main)]">{value}</p></article>;
}

function ReportRows({ rows, emptyLabel }: { rows: Array<{ label: string; value: number }>; emptyLabel: string }) {
  const maximum = Math.max(...rows.map((row) => row.value), 1);
  if (rows.length === 0) return <p className="text-sm text-[var(--text-soft)]">{emptyLabel}</p>;
  return <div className="space-y-3">{rows.map((row) => <div key={row.label}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-[var(--text-main)]">{row.label}</span><span className="font-bold text-[var(--text-main)]">{row.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-[rgba(198,152,53,0.1)]"><div className="h-full rounded-full bg-[var(--gold-500)]" style={{ width: `${Math.max((row.value / maximum) * 100, 4)}%` }} /></div></div>)}</div>;
}

export function ReportsScreen() {
  const { data, navigate } = useApp();
  const currentUser = useCurrentUser();
  const today = todayIso();
  const defaultRange = currentMonthRange(today);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);

  const canViewReports = can(currentUser.role, "view_reports");
  const canViewFinance = can(currentUser.role, "view_finance");

  const visibleCases = currentUser.role === "legal_staff"
    ? data.cases.filter((caseItem) => caseItem.assignedTo === currentUser.id && !caseItem.archivedAt)
    : data.cases.filter((caseItem) => !caseItem.archivedAt);

  const reportCases = useMemo(
    () => visibleCases.filter((caseItem) => isInDateRange(caseItem.receivedDate || caseItem.createdAt.slice(0, 10), { from, to })),
    [from, to, visibleCases]
  );
  const reportTasks = useMemo(
    () => visibleTasksForRole(data.tasks, currentUser.role, currentUser.id).filter((task) => isInDateRange(task.dueDate, { from, to })),
    [data.tasks, currentUser.id, currentUser.role, from, to]
  );
  const reportPayments = useMemo(
    () => data.payments.filter((payment) => isInDateRange(payment.paymentDate, { from, to })),
    [data.payments, from, to]
  );

  const caseStatusRows = useMemo(() => countCasesByStatus(reportCases).map((item) => ({ label: item.status, value: item.count })), [reportCases]);
  const taskStatusRows = useMemo(() => countTasksByStatus(reportTasks).map((item) => ({ label: item.status, value: item.count })), [reportTasks]);
  const finance = useMemo(() => financeSummary(reportPayments), [reportPayments]);
  const dueSoon = visibleCases.filter((caseItem) => isDueSoon(caseItem.promisedDate, today)).length;
  const overdue = visibleCases.filter((caseItem) => isOverdue(caseItem.promisedDate, today)).length;
  const completedTasks = reportTasks.filter((task) => task.status === "Hoàn thành").length;
  const overdueTasks = visibleTasksForRole(data.tasks, currentUser.role, currentUser.id).filter((task) => task.status !== "Hoàn thành" && task.dueDate < today).length;
  const agencies = useMemo(() => {
    const allowedCaseIds = new Set(reportCases.map((caseItem) => caseItem.id));
    const counts = new Map<string, number>();
    data.submissions.filter((submission) => allowedCaseIds.has(submission.caseId)).forEach((submission) => {
      const agency = submission.receivingAgency.trim() || "Chưa xác định";
      counts.set(agency, (counts.get(agency) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value })).sort((first, second) => second.value - first.value).slice(0, 6);
  }, [data.submissions, reportCases]);

  if (!canViewReports) {
    return <EmptyState title="Không có quyền xem báo cáo" message="Chức năng này dành cho quản trị, quản lý và kế toán." />;
  }

  return (
    <div className="space-y-4 pb-6 md:space-y-6">
      <section className="luxe-panel-strong rounded-[1.5rem] p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Báo cáo vận hành</p><h2 className="mt-1 text-xl font-black text-[var(--text-main)]">Hồ sơ và công việc</h2><p className="mt-1 text-sm text-[var(--text-soft)]">Các số liệu tổng hợp được tách khỏi Tổng quan để dễ theo dõi định kỳ.</p></div>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-[var(--text-soft)]">Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="luxe-input mt-1 block w-full rounded-xl px-3 py-2 text-sm outline-none" /></label><label className="text-xs font-semibold text-[var(--text-soft)]">Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="luxe-input mt-1 block w-full rounded-xl px-3 py-2 text-sm outline-none" /></label></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric label="Hồ sơ trong kỳ" value={reportCases.length} icon={<FileText size={18} />} tone="bg-[rgba(255,245,220,0.95)] text-[var(--gold-700)]" />
        <ReportMetric label="Hồ sơ sắp hạn" value={dueSoon} icon={<CalendarCheck2 size={18} />} tone="bg-amber-50 text-amber-700" />
        <ReportMetric label="Hồ sơ quá hạn" value={overdue} icon={<TriangleAlert size={18} />} tone="bg-rose-50 text-rose-700" />
        <ReportMetric label="Công việc hoàn thành" value={`${completedTasks}/${reportTasks.length}`} icon={<ClipboardList size={18} />} tone="bg-emerald-50 text-emerald-700" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="luxe-panel rounded-[1.5rem] p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-[var(--text-main)]">Tình trạng hồ sơ</h3><p className="mt-1 text-xs text-[var(--text-soft)]">Hồ sơ nhận trong khoảng thời gian đã chọn.</p></div><button onClick={() => navigate("cases")} className="text-xs font-bold text-[var(--gold-700)]">Mở hồ sơ</button></div><ReportRows rows={caseStatusRows} emptyLabel="Không có hồ sơ trong kỳ này." /></section>
        <section className="luxe-panel rounded-[1.5rem] p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-[var(--text-main)]">Tiến độ công việc</h3><p className="mt-1 text-xs text-[var(--text-soft)]">Quá hạn hiện tại: {overdueTasks} việc.</p></div><button onClick={() => navigate("tasks")} className="text-xs font-bold text-[var(--gold-700)]">Mở công việc</button></div><ReportRows rows={taskStatusRows} emptyLabel="Không có công việc trong kỳ này." /></section>
        <section className="luxe-panel rounded-[1.5rem] p-4 md:p-5"><div className="mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-[var(--gold-700)]" /><div><h3 className="font-bold text-[var(--text-main)]">Khu vực / cơ quan nộp</h3><p className="mt-1 text-xs text-[var(--text-soft)]">Số lần nộp theo cơ quan tiếp nhận.</p></div></div><ReportRows rows={agencies} emptyLabel="Chưa có lần nộp trong kỳ này." /></section>
        {canViewFinance ? <section className="luxe-panel rounded-[1.5rem] p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><CircleDollarSign size={18} className="text-[var(--gold-700)]" /><div><h3 className="font-bold text-[var(--text-main)]">Tài chính trong kỳ</h3><p className="mt-1 text-xs text-[var(--text-soft)]">Thu chi thuộc khoảng thời gian đã chọn.</p></div></div><button onClick={() => navigate("finance", { rangeFrom: from, rangeTo: to })} className="text-xs font-bold text-[var(--gold-700)]">Xem thu chi</button></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-700">Đã thu</p><p className="mt-1 font-black text-emerald-800">{formatVnd(finance.received)}</p></div><div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-semibold text-rose-700">Đã chi</p><p className="mt-1 font-black text-rose-800">{formatVnd(finance.spent)}</p></div><div className="col-span-2 rounded-xl bg-[rgba(255,245,220,0.8)] p-3"><p className="text-xs font-semibold text-[var(--gold-700)]">Dòng tiền thuần</p><p className="mt-1 font-black text-[var(--text-main)]">{formatVnd(finance.netCashflow)}</p></div></div></section> : null}
      </div>
    </div>
  );
}
