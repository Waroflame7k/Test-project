"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, ListTodo } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { formatDate, todayIso } from "@/lib/date";
import { visibleTasksForRole } from "@/lib/task-utils";
import type { CaseTask } from "@/types/domain";

type CalendarMode = "week" | "month";

type CalendarData = {
  cases: Array<{ id: string; customerId: string }>;
  customers: Array<{ id: string; fullName: string }>;
};

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addCalendarDays(iso: string, days: number): string {
  const date = dateFromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function weekStart(iso: string): string {
  const date = dateFromIso(iso);
  date.setDate(date.getDate() - date.getDay());
  return toIso(date);
}

function monthStart(iso: string): string {
  const date = dateFromIso(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function taskTone(task: CaseTask): string {
  if (task.status === "Hoàn thành") return "bg-emerald-100 text-emerald-800";
  if (task.priority === "Khẩn") return "bg-rose-100 text-rose-800";
  if (task.priority === "Cao") return "bg-amber-100 text-amber-800";
  return "bg-[rgba(255,245,220,0.92)] text-[var(--gold-700)]";
}

function customerNameForTask(data: CalendarData, task: CaseTask) {
  const caseItem = data.cases.find((item) => item.id === task.caseId);
  return data.customers.find((item) => item.id === caseItem?.customerId)?.fullName ?? "Chưa xác định khách hàng";
}

export function TaskCalendarScreen() {
  const { data, navigate } = useApp();
  const currentUser = useCurrentUser();
  const today = todayIso();
  const [mode, setMode] = useState<CalendarMode>("week");
  const [cursor, setCursor] = useState(today);

  const tasks = useMemo(
    () =>
      visibleTasksForRole(data.tasks, currentUser.role, currentUser.id).sort(
        (first, second) =>
          first.dueDate.localeCompare(second.dueDate) || (first.dueTime ?? "99:99").localeCompare(second.dueTime ?? "99:99")
      ),
    [currentUser.id, currentUser.role, data.tasks]
  );
  const tasksByDate = useMemo(() => {
    const groups = new Map<string, CaseTask[]>();
    tasks.forEach((task) => groups.set(task.dueDate, [...(groups.get(task.dueDate) ?? []), task]));
    return groups;
  }, [tasks]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart(cursor), index)), [cursor]);
  const monthCells = useMemo(() => {
    const first = dateFromIso(monthStart(cursor));
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => addCalendarDays(toIso(start), index));
  }, [cursor]);
  const cursorDate = dateFromIso(cursor);
  const title = mode === "week" ? `${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}` : `Tháng ${String(cursorDate.getMonth() + 1).padStart(2, "0")}/${cursorDate.getFullYear()}`;

  function moveCalendar(direction: -1 | 1) {
    if (mode === "week") {
      setCursor(addCalendarDays(cursor, direction * 7));
      return;
    }
    const nextMonth = dateFromIso(monthStart(cursor));
    nextMonth.setMonth(nextMonth.getMonth() + direction);
    setCursor(toIso(nextMonth));
  }

  function openCase(caseId: string) {
    navigate("case-detail", { caseId, returnTo: "tasks", tab: "tasks" });
  }

  return (
    <div className="space-y-4 pb-6 md:space-y-6">
      <section className="luxe-panel-strong rounded-[1.5rem] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Lịch công việc</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">Lịch tuần và tháng</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">Mỗi thẻ hiển thị việc cần làm và khách hàng. Bấm thẻ để mở hồ sơ.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-[rgba(198,152,53,0.16)] bg-white p-1">
              <button onClick={() => setMode("week")} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "week" ? "luxe-button-primary" : "text-[var(--text-soft)]"}`}>Tuần</button>
              <button onClick={() => setMode("month")} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "month" ? "luxe-button-primary" : "text-[var(--text-soft)]"}`}>Tháng</button>
            </div>
            <button onClick={() => navigate("tasks")} className="rounded-xl px-3 py-2 text-xs font-bold luxe-button-secondary">Danh sách</button>
          </div>
        </div>
      </section>

      <section className="luxe-panel overflow-hidden rounded-[1.5rem]">
        <div className="flex items-center justify-between border-b luxe-divider px-3 py-3 md:px-5">
          <button type="button" onClick={() => moveCalendar(-1)} className="flex h-9 w-9 items-center justify-center rounded-full luxe-button-ghost" aria-label="Tuần hoặc tháng trước"><ChevronLeft size={18} /></button>
          <div className="text-center"><p className="text-sm font-black text-[var(--text-main)]">{title}</p><button onClick={() => setCursor(today)} className="mt-1 text-xs font-bold text-[var(--gold-700)]">Hôm nay</button></div>
          <button type="button" onClick={() => moveCalendar(1)} className="flex h-9 w-9 items-center justify-center rounded-full luxe-button-ghost" aria-label="Tuần hoặc tháng sau"><ChevronRight size={18} /></button>
        </div>

        {mode === "week" ? (
          <div className="overflow-x-auto"><div className="grid min-w-[760px] grid-cols-7 divide-x divide-[rgba(198,152,53,0.1)]">{weekDates.map((date, index) => <WeekDay key={date} date={date} today={today} label={WEEKDAY_LABELS[index]} tasks={tasksByDate.get(date) ?? []} data={data} onOpenCase={openCase} />)}</div></div>
        ) : (
          <div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-7 border-b border-[rgba(198,152,53,0.1)]">{WEEKDAY_LABELS.map((label) => <div key={label} className="px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-faint)]">{label}</div>)}</div><div className="grid grid-cols-7">{monthCells.map((date) => <MonthDay key={date} date={date} activeMonth={cursor.slice(0, 7)} today={today} tasks={tasksByDate.get(date) ?? []} data={data} onOpenCase={openCase} onOpenTasks={() => navigate("tasks")} />)}</div></div></div>
        )}
      </section>

      {tasks.length === 0 ? <EmptyState title="Chưa có công việc" message="Tạo công việc từ mục Công việc hoặc chi tiết hồ sơ." icon={<ListTodo size={28} />} /> : null}
    </div>
  );
}

function WeekDay({ date, today, label, tasks, data, onOpenCase }: { date: string; today: string; label: string; tasks: CaseTask[]; data: CalendarData; onOpenCase: (caseId: string) => void }) {
  return <div className={`min-h-[420px] p-3 ${date === today ? "bg-[rgba(255,249,238,0.7)]" : "bg-white"}`}><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold text-[var(--text-faint)]">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${date === today ? "gold-gradient-bg text-white" : "text-[var(--text-main)]"}`}>{date.slice(-2)}</span></div><div className="space-y-2">{tasks.length === 0 ? <p className="pt-6 text-center text-xs text-[var(--text-faint)]">Không có việc</p> : tasks.map((task) => <TaskChip key={task.id} task={task} customerName={customerNameForTask(data, task)} onOpenCase={onOpenCase} />)}</div></div>;
}

function MonthDay({ date, activeMonth, today, tasks, data, onOpenCase, onOpenTasks }: { date: string; activeMonth: string; today: string; tasks: CaseTask[]; data: CalendarData; onOpenCase: (caseId: string) => void; onOpenTasks: () => void }) {
  const currentMonth = date.startsWith(activeMonth);
  return <div className={`min-h-[126px] border-b border-r border-[rgba(198,152,53,0.08)] p-2 ${currentMonth ? "bg-white" : "bg-[rgba(251,246,236,0.42)]"}`}><div className="mb-2 flex justify-between"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${date === today ? "gold-gradient-bg text-white" : currentMonth ? "text-[var(--text-main)]" : "text-[var(--text-faint)]"}`}>{date.slice(-2)}</span>{tasks.length > 0 ? <span className="rounded-full bg-[rgba(255,245,220,0.9)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold-700)]">{tasks.length}</span> : null}</div><div className="space-y-1">{tasks.slice(0, 2).map((task) => <TaskChip key={task.id} task={task} customerName={customerNameForTask(data, task)} onOpenCase={onOpenCase} compact />)}{tasks.length > 2 ? <button type="button" onClick={onOpenTasks} className="text-[10px] font-bold text-[var(--gold-700)] hover:underline">+{tasks.length - 2} việc khác</button> : null}</div></div>;
}

function TaskChip({ task, customerName, onOpenCase, compact = false }: { task: CaseTask; customerName: string; onOpenCase: (caseId: string) => void; compact?: boolean }) {
  const fullLabel = `${task.title} - ${customerName}`;
  return <button type="button" title={fullLabel} onClick={() => onOpenCase(task.caseId)} className={`block w-full rounded-lg px-2 py-1.5 text-left transition hover:brightness-95 ${taskTone(task)}`}><div className="flex items-center gap-1"><Clock3 size={compact ? 9 : 11} className="shrink-0" /><span className={`font-bold ${compact ? "text-[10px]" : "text-xs"}`}>{task.dueTime ?? "Cả ngày"}</span></div><p className={`mt-0.5 font-bold leading-snug ${compact ? "truncate text-[10px]" : "break-words text-xs"}`}>{task.title}</p><p className={`mt-0.5 font-medium opacity-80 ${compact ? "truncate text-[10px]" : "break-words text-[11px]"}`}>{customerName}</p></button>;
}
