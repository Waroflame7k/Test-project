"use client";

import { useState } from "react";
import { Plus, Clock, CheckCircle, Circle, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { Modal } from "@/components/ui/modal";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { todayIso, formatDate } from "@/lib/date";
import { can } from "@/lib/permissions";
import type { CaseTask, Priority } from "@/types/domain";

type TabKey = "mine" | "completed" | "overdue";

const WEEK_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTH_DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function TasksScreen() {
  const { data, navigate, addTask, completeTask } = useApp();
  const currentUser = useCurrentUser();
  const today = todayIso();
  const todayDate = new Date();

  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeTab, setActiveTab] = useState<TabKey>("mine");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCaseId, setTaskCaseId] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState(currentUser.id);
  const [taskDueDate, setTaskDueDate] = useState(today);
  const [taskDueTime, setTaskDueTime] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("Trung bình");

  // Week strip (mobile)
  const weekStart = getWeekStart(new Date(todayDate.getTime() + weekOffset * 7 * 86400000));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Full month calendar (desktop)
  const monthRef = new Date(todayDate.getFullYear(), todayDate.getMonth() + monthOffset, 1);
  const firstDayOfMonth = monthRef.getDay(); // 0=Sun
  const daysInMonth = new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 0).getDate();
  // build grid: pad with nulls before first day
  const calendarCells: (Date | null)[] = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(monthRef.getFullYear(), monthRef.getMonth(), i + 1)),
  ];
  // pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const isAdmin = currentUser.role === "admin" || currentUser.role === "manager";

  function hasTasks(dateIso: string): boolean {
    return data.tasks.some((t) => {
      if (!isAdmin && t.assignedTo !== currentUser.id) return false;
      return t.dueDate === dateIso && t.status !== "Hoàn thành";
    });
  }

  const myTasks = data.tasks.filter((t) => {
    if (!isAdmin && t.assignedTo !== currentUser.id) return false;
    return true;
  });

  function getTabTasks(): CaseTask[] {
    switch (activeTab) {
      case "completed":
        return myTasks.filter((t) => t.status === "Hoàn thành");
      case "overdue":
        return myTasks.filter((t) => t.status !== "Hoàn thành" && t.dueDate < today);
      default:
        return myTasks.filter((t) => t.status !== "Hoàn thành" && t.dueDate === selectedDate);
    }
  }

  const displayedTasks = getTabTasks();
  const canComplete = can(currentUser.role, "complete_tasks");

  function handleAddTask() {
    if (!taskTitle.trim() || !taskDueDate) return;
    addTask({
      title: taskTitle,
      caseId: taskCaseId,
      assignedTo: taskAssignedTo,
      dueDate: taskDueDate,
      dueTime: taskDueTime || undefined,
      priority: taskPriority,
      status: "Chưa làm",
    });
    setTaskTitle("");
    setTaskCaseId("");
    setTaskDueDate(today);
    setTaskDueTime("");
    setTaskPriority("Trung bình");
    setAddModalOpen(false);
  }

  // Shared task list rendering
  function renderTaskList() {
    return (
      <>
        {displayedTasks.length === 0 ? (
          <EmptyState
            title={activeTab === "completed" ? "Chưa hoàn thành việc nào" : "Không có công việc"}
            message={activeTab === "mine" ? `Ngày ${formatDate(selectedDate)} chưa có việc.` : ""}
          />
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-3 pl-8">
              {displayedTasks.map((task) => {
                const taskCase = data.cases.find((c) => c.id === task.caseId);
                return (
                  <div key={task.id} className="relative">
                    <div className="absolute -left-4 top-4 w-3 h-3 rounded-full bg-[#ea580c] -translate-x-1/2 z-10" />
                    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3">
                      <button
                        onClick={() => canComplete && task.status !== "Hoàn thành" && completeTask(task.id)}
                        className={canComplete ? "cursor-pointer mt-0.5" : "cursor-default mt-0.5"}
                      >
                        {task.status === "Hoàn thành" ? (
                          <CheckCircle size={20} className="text-green-500" />
                        ) : (
                          <Circle size={20} className="text-gray-300" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            task.status === "Hoàn thành" ? "line-through text-gray-400" : "text-gray-800"
                          }`}
                        >
                          {task.title}
                        </p>
                        {taskCase && (
                          <button
                            onClick={() => navigate("case-detail", { caseId: task.caseId })}
                            className="text-xs text-[#1a3a8a] font-medium mt-0.5 hover:underline"
                          >
                            {taskCase.caseCode}
                          </button>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <PriorityBadge priority={task.priority} />
                          {task.dueTime && (
                            <span className="flex items-center gap-1 text-xs text-[#ea580c]">
                              <Clock size={11} /> {task.dueTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Mobile layout ── */}
      <div className="md:hidden flex flex-col h-full">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-extrabold text-[#1a3a8a] mb-3">Công việc</h1>

          {/* Week strip */}
          <div className="bg-white rounded-2xl shadow-sm p-3">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1a3a8a]"
              >
                ‹
              </button>
              <span className="text-sm font-bold text-[#1a3a8a]">{monthLabel(weekDates[0])}</span>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1a3a8a]"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((d, i) => {
                const iso = dateToIso(d);
                const isToday = iso === today;
                const isSelected = iso === selectedDate;
                const hasTaskDot = hasTasks(iso);
                return (
                  <button
                    key={iso}
                    onClick={() => {
                      setSelectedDate(iso);
                      setActiveTab("mine");
                    }}
                    className="flex flex-col items-center py-1"
                  >
                    <span
                      className={`text-[10px] mb-1 font-medium ${
                        isToday ? "text-[#ea580c]" : "text-gray-400"
                      }`}
                    >
                      {isToday ? "Hôm nay" : WEEK_DAYS[i]}
                    </span>
                    <span
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${
                        isSelected
                          ? "bg-[#ea580c] text-white"
                          : isToday
                          ? "text-[#ea580c] font-extrabold"
                          : "text-[#1a3a8a]"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className={`w-1 h-1 rounded-full mt-1 ${hasTaskDot ? "bg-[#ea580c]" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([
              { key: "mine" as TabKey, label: "Hôm nay" },
              { key: "completed" as TabKey, label: "Đã xong" },
              { key: "overdue" as TabKey, label: "Quá hạn" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab.key ? "bg-white text-[#1a3a8a] shadow-sm" : "text-gray-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-0">
          {renderTaskList()}
        </div>

        <div className="px-4 pb-6">
          <button
            onClick={() => setAddModalOpen(true)}
            className="w-full bg-[#ea580c] hover:bg-orange-600 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={18} /> Thêm công việc
          </button>
        </div>
      </div>

      {/* ── Desktop layout: calendar + task list side by side ── */}
      <div className="hidden md:flex gap-6 p-6 h-full overflow-hidden">
        {/* Left: full month calendar */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="bg-white rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <button
                onClick={() => setMonthOffset((m) => m - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1a3a8a]"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-base font-bold text-[#1a3a8a]">{monthLabel(monthRef)}</span>
              <button
                onClick={() => setMonthOffset((m) => m + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#1a3a8a]"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 px-4 py-2 shrink-0">
              {MONTH_DAY_LABELS.map((label) => (
                <div key={label} className="text-center text-xs font-semibold text-gray-400">
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 px-4 pb-4 overflow-y-auto">
              {calendarCells.map((d, idx) => {
                if (!d) return <div key={`empty-${idx}`} />;
                const iso = dateToIso(d);
                const isToday = iso === today;
                const isSelected = iso === selectedDate;
                const hasTaskDot = hasTasks(iso);
                return (
                  <button
                    key={iso}
                    onClick={() => {
                      setSelectedDate(iso);
                      setActiveTab("mine");
                    }}
                    className={`flex flex-col items-center py-2 rounded-xl transition-colors ${
                      isSelected
                        ? "bg-[#ea580c] text-white"
                        : isToday
                        ? "bg-orange-50 text-[#ea580c]"
                        : "hover:bg-gray-50 text-[#1a3a8a]"
                    }`}
                  >
                    <span className="text-sm font-bold">{d.getDate()}</span>
                    <div
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        hasTaskDot
                          ? isSelected
                            ? "bg-white"
                            : "bg-[#ea580c]"
                          : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: task list */}
        <div className="w-96 shrink-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-base font-bold text-[#1a3a8a]">
              {activeTab === "mine"
                ? `Ngày ${formatDate(selectedDate)}`
                : activeTab === "completed"
                ? "Đã hoàn thành"
                : "Quá hạn"}
            </h2>
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#ea580c] hover:bg-orange-600 text-white rounded-xl px-3 py-2 font-semibold text-sm transition-colors"
            >
              <Plus size={15} /> Thêm
            </button>
          </div>

          {/* Tab filter */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 shrink-0">
            {([
              { key: "mine" as TabKey, label: "Hôm nay" },
              { key: "completed" as TabKey, label: "Đã xong" },
              { key: "overdue" as TabKey, label: "Quá hạn" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab.key ? "bg-white text-[#1a3a8a] shadow-sm" : "text-gray-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-0">
            {renderTaskList()}
          </div>
        </div>
      </div>

      {/* ── Add task modal (shared) ── */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Thêm công việc">
        <div className="space-y-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            placeholder="Tiêu đề công việc *"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            value={taskCaseId}
            onChange={(e) => setTaskCaseId(e.target.value)}
          >
            <option value="">Không liên kết hồ sơ</option>
            {data.cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseCode}
              </option>
            ))}
          </select>
          {isAdmin && (
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={taskAssignedTo}
              onChange={(e) => setTaskAssignedTo(e.target.value)}
            >
              {data.profiles.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          )}
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            value={taskPriority}
            onChange={(e) => setTaskPriority(e.target.value as Priority)}
          >
            {(["Thấp", "Trung bình", "Cao", "Khẩn"] as Priority[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Ngày hạn</label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Giờ</label>
              <input
                type="time"
                value={taskDueTime}
                onChange={(e) => setTaskDueTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleAddTask}
            disabled={!taskTitle.trim()}
            className="w-full bg-[#ea580c] disabled:opacity-50 text-white font-bold rounded-xl py-3"
          >
            Lưu
          </button>
        </div>
      </Modal>
    </div>
  );
}
