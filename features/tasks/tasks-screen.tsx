"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Circle, Clock3, ListTodo, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { formatDate, isOverdue, todayIso } from "@/lib/date";
import { can } from "@/lib/permissions";
import { visibleTasksForRole } from "@/lib/task-utils";
import type { Priority } from "@/types/domain";

type TaskFilter = "active" | "completed" | "overdue";

const FILTERS: Array<{ key: TaskFilter; label: string }> = [
  { key: "active", label: "Cần làm" },
  { key: "completed", label: "Đã hoàn thành" },
  { key: "overdue", label: "Quá hạn" },
];

export function TasksScreen() {
  const { data, navigate, addTask, completeTask } = useApp();
  const currentUser = useCurrentUser();
  const today = todayIso();
  const [filter, setFilter] = useState<TaskFilter>("active");
  const [addOpen, setAddOpen] = useState(false);

  const allTasks = useMemo(
    () => visibleTasksForRole(data.tasks, currentUser.role, currentUser.id),
    [currentUser.id, currentUser.role, data.tasks]
  );
  const taskCounts = {
    active: allTasks.filter((task) => task.status !== "Hoàn thành").length,
    completed: allTasks.filter((task) => task.status === "Hoàn thành").length,
    overdue: allTasks.filter((task) => task.status !== "Hoàn thành" && isOverdue(task.dueDate, today)).length,
  };
  const tasks = useMemo(() => {
    const filtered = allTasks.filter((task) => {
      if (filter === "completed") return task.status === "Hoàn thành";
      if (filter === "overdue") return task.status !== "Hoàn thành" && isOverdue(task.dueDate, today);
      return task.status !== "Hoàn thành";
    });
    return filtered.sort(
      (first, second) => first.dueDate.localeCompare(second.dueDate) || (first.dueTime ?? "99:99").localeCompare(second.dueTime ?? "99:99")
    );
  }, [allTasks, filter, today]);
  const canComplete = can(currentUser.role, "complete_tasks");
  const canAssign = can(currentUser.role, "assign_staff");
  const taskCaseOptions = data.cases
    .filter((caseItem) => !caseItem.archivedAt)
    .map((caseItem) => {
      const customer = data.customers.find((item) => item.id === caseItem.customerId);
      return {
        id: caseItem.id,
        label: `${customer?.fullName ?? "Chưa có khách hàng"} - ${caseItem.serviceType} (${caseItem.caseCode})`,
      };
    })
    .sort((first, second) => first.label.localeCompare(second.label, "vi"));

  return (
    <div className="space-y-4 pb-6 md:space-y-6">
      <section className="luxe-panel-strong rounded-[1.5rem] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Điều phối công việc</p><h2 className="mt-1 text-xl font-black text-[var(--text-main)]">Công việc</h2><p className="mt-1 text-sm text-[var(--text-soft)]">Danh sách việc cần xử lý; lịch tuần và tháng nằm ở trang riêng.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => navigate("task-calendar")} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold luxe-button-secondary"><CalendarDays size={17} /> Mở lịch tuần/tháng</button><button onClick={() => setAddOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold luxe-button-primary"><Plus size={17} /> Thêm công việc</button></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2"><Stat label="Cần làm" value={taskCounts.active} tone="text-[var(--gold-700)]" /><Stat label="Hoàn thành" value={taskCounts.completed} tone="text-emerald-700" /><Stat label="Quá hạn" value={taskCounts.overdue} tone="text-rose-700" /></div>
      </section>

      <section className="luxe-panel rounded-[1.5rem] p-3 md:p-5">
        <div className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map((item) => <button key={item.key} onClick={() => setFilter(item.key)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition ${filter === item.key ? "luxe-button-primary" : "luxe-button-secondary"}`}>{item.label} ({taskCounts[item.key]})</button>)}</div>
      </section>

      {tasks.length === 0 ? <EmptyState title="Không có công việc" message={filter === "active" ? "Bạn chưa có đầu việc nào cần xử lý." : "Không có công việc phù hợp với bộ lọc này."} icon={<ListTodo size={28} />} /> : <section className="space-y-3">{tasks.map((task) => {
        const caseItem = data.cases.find((item) => item.id === task.caseId);
        const customer = data.customers.find((item) => item.id === caseItem?.customerId);
        const assignee = data.profiles.find((item) => item.id === task.assignedTo);
        const overdue = task.status !== "Hoàn thành" && isOverdue(task.dueDate, today);
        return <article key={task.id} onClick={() => caseItem && navigate("case-detail", { caseId: caseItem.id, returnTo: "tasks" })} className={`luxe-card rounded-[1.4rem] p-4 ${caseItem ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" : ""}`}><div className="flex items-start gap-3"><button type="button" disabled={!canComplete || task.status === "Hoàn thành"} onClick={(event) => { event.stopPropagation(); completeTask(task.id); }} className="mt-0.5 shrink-0 disabled:cursor-default">{task.status === "Hoàn thành" ? <CheckCircle2 size={22} className="text-emerald-600" /> : <Circle size={22} className="text-[var(--gold-700)]" />}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className={`text-sm font-bold ${task.status === "Hoàn thành" ? "text-[var(--text-faint)] line-through" : "text-[var(--text-main)]"}`}>{task.title}</p><p className="mt-1 text-xs text-[var(--text-soft)]">{assignee?.fullName ?? "Chưa phân công"}</p></div><PriorityBadge priority={task.priority} /></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs"><span className={`inline-flex items-center gap-1 font-semibold ${overdue ? "text-rose-700" : "text-[var(--text-soft)]"}`}><Clock3 size={13} /> {overdue ? "Quá hạn · " : "Hạn · "}{formatDate(task.dueDate)} {task.dueTime ?? ""}</span>{caseItem ? <span className="font-bold text-[var(--gold-700)]">{customer?.fullName ?? "Mở hồ sơ"} · {caseItem.serviceType}</span> : null}</div></div></div></article>;
      })}</section>}

      <TaskModal open={addOpen} onClose={() => setAddOpen(false)} cases={taskCaseOptions} profiles={data.profiles} currentUserId={currentUser.id} canAssign={canAssign} onSubmit={(task) => { addTask(task); setAddOpen(false); }} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl border border-[rgba(198,152,53,0.14)] bg-white px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">{label}</p><p className={`mt-1 text-xl font-black ${tone}`}>{value}</p></div>;
}

function TaskModal({ open, onClose, cases, profiles, currentUserId, canAssign, onSubmit }: { open: boolean; onClose: () => void; cases: Array<{ id: string; label: string }>; profiles: Array<{ id: string; fullName: string; active?: boolean }>; currentUserId: string; canAssign: boolean; onSubmit: (task: { title: string; caseId: string; assignedTo: string; dueDate: string; dueTime?: string; priority: Priority; status: "Chưa làm" }) => void }) {
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [dueDate, setDueDate] = useState(todayIso());
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<Priority>("Trung bình");
  function submit() { if (!title.trim() || !caseId || !assignedTo || !dueDate) return; onSubmit({ title: title.trim(), caseId, assignedTo, dueDate, dueTime: dueTime || undefined, priority, status: "Chưa làm" }); setTitle(""); setCaseId(""); setDueTime(""); setPriority("Trung bình"); }
  return <Modal open={open} onClose={onClose} title="Thêm công việc"><div className="space-y-3"><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Tên công việc</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Hồ sơ khách hàng</span><select value={caseId} onChange={(event) => setCaseId(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"><option value="">Chọn khách hàng và hồ sơ</option>{cases.map((caseItem) => <option key={caseItem.id} value={caseItem.id}>{caseItem.label}</option>)}</select></label>{canAssign ? <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Người phụ trách</span><select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none">{profiles.filter((profile) => profile.active !== false).map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName}</option>)}</select></label> : null}<div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Hạn</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Giờ</span><input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></label></div><label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">Ưu tiên</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none">{(["Thấp", "Trung bình", "Cao", "Khẩn"] as Priority[]).map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={submit} className="w-full rounded-xl py-3 text-sm font-bold luxe-button-primary">Tạo công việc</button></div></Modal>;
}
