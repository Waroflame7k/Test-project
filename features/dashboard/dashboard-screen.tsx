"use client";

import {
  CalendarClock,
  CheckSquare,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  TriangleAlert,
} from "lucide-react";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { buildAlerts } from "@/lib/alerts";
import { formatDate, isDueSoon, isOverdue, todayIso } from "@/lib/date";
import { can } from "@/lib/permissions";
import { isCaseActive, receivableForCase } from "@/lib/case-utils";
import { canSeeAllTasks } from "@/lib/task-utils";
import { formatVnd } from "@/lib/money";
import type { AlertItem } from "@/lib/alerts";
import type { AppData, Case } from "@/types/domain";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function SectionCard({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="luxe-panel rounded-[1.75rem] p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--text-main)] md:text-lg">{title}</h2>
          {hint ? <p className="mt-1 text-xs text-[var(--text-soft)] md:text-sm">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RecentCasesList({
  recentCases,
  data,
  navigate,
}: {
  recentCases: Case[];
  data: AppData;
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}) {
  if (recentCases.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title="Hồ sơ cập nhật gần đây"
      hint="Theo dõi nhanh các hồ sơ vừa thay đổi để quay lại xử lý tiếp."
      action={
        <button
          onClick={() => navigate("cases")}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--gold-700)] transition hover:bg-[rgba(255,248,231,0.86)]"
        >
          Xem tất cả
          <ChevronRight size={14} />
        </button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {recentCases.map((caseItem) => {
          const customer = data.customers.find((item) => item.id === caseItem.customerId);
          return (
            <button
              key={caseItem.id}
              onClick={() => navigate("case-detail", { caseId: caseItem.id })}
              className="luxe-card rounded-[1.35rem] p-4 text-left"
            >
              <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(198,152,53,0.18)] bg-white text-[var(--gold-700)]">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold text-[var(--text-main)] md:text-base">
                      {customer?.fullName ?? "Chưa có khách hàng"}
                    </p>
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />
                  </div>
                  <p className="mt-1 truncate text-sm text-[var(--gold-700)]">{caseItem.serviceType}</p>
                  <p className="mt-2 text-xs text-[var(--text-soft)]">
                    Cập nhật {formatDate(caseItem.updatedAt.slice(0, 10))}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function DashboardScreen() {
  const { data, navigate } = useApp();
  const currentUser = useCurrentUser();
  const today = todayIso();

  const visibleCases =
    currentUser.role === "legal_staff"
      ? data.cases.filter((caseItem) => caseItem.assignedTo === currentUser.id)
      : data.cases;

  const activeCases = visibleCases.filter((caseItem) => isCaseActive(caseItem.status));
  const dueSoonCases = activeCases.filter((caseItem) => isDueSoon(caseItem.promisedDate, today));
  const overdueCases = activeCases.filter((caseItem) => isOverdue(caseItem.promisedDate, today));
  const needSupplementCases = activeCases.filter((caseItem) => caseItem.status === "Cần bổ sung");

  const totalReceivable = visibleCases.reduce(
    (sum, caseItem) => sum + Math.max(0, receivableForCase(caseItem, data.payments)),
    0
  );

  const recentCases = [...visibleCases]
    .sort((firstCase, secondCase) => secondCase.updatedAt.localeCompare(firstCase.updatedAt))
    .slice(0, 4);

  const myTasks = data.tasks.filter((task) => {
    if (!canSeeAllTasks(currentUser.role) && task.assignedTo !== currentUser.id) {
      return false;
    }
    if (task.status === "Hoàn thành") {
      return false;
    }
    return task.dueDate <= today;
  });

  const alerts: AlertItem[] = can(currentUser.role, "view_reports") ? buildAlerts(data, today) : [];
  const showReceivable = can(currentUser.role, "view_finance") && totalReceivable > 0;

  const metricCards = [
    {
      label: "Đang xử lý",
      value: activeCases.length,
      note: "Hồ sơ còn đang vận hành",
      icon: <FileText size={18} />,
      accent: "text-[var(--gold-700)] border border-[rgba(198,152,53,0.18)] bg-white",
    },
    {
      label: "Sắp đến hạn",
      value: dueSoonCases.length,
      note: "Cần ưu tiên trong vài ngày tới",
      icon: <CalendarClock size={18} />,
      accent: "text-[#b97316] border border-[rgba(215,157,76,0.18)] bg-white",
    },
    {
      label: "Quá hạn",
      value: overdueCases.length,
      note: "Nên xử lý hoặc cập nhật ngay",
      icon: <Clock3 size={18} />,
      accent: "text-[#a7482d] border border-[rgba(188,96,74,0.16)] bg-white",
    },
    {
      label: "Chờ bổ sung",
      value: needSupplementCases.length,
      note: "Đang phụ thuộc thêm giấy tờ",
      icon: <ClipboardList size={18} />,
      accent: "text-[#7a5a14] border border-[rgba(198,152,53,0.18)] bg-white",
    },
  ];

  const signalCards = [
    {
      label: "Việc đến hạn hôm nay",
      value: myTasks.length,
      icon: <CheckSquare size={16} />,
    },
    {
      label: "Cảnh báo đang mở",
      value: alerts.length,
      icon: <TriangleAlert size={16} />,
    },
    ...(showReceivable
      ? [
          {
            label: "Khoản còn phải thu",
            value: formatVnd(totalReceivable),
            icon: <CircleDollarSign size={16} />,
          },
        ]
      : []),
  ];

  const alertToneMap: Record<
    AlertItem["level"],
    { wrapper: string; title: string; pill: string }
  > = {
    Đỏ: {
      wrapper: "border-[rgba(194,84,62,0.18)] bg-[rgba(255,241,237,0.88)]",
      title: "text-[#9f2f19]",
      pill: "bg-[rgba(194,84,62,0.12)] text-[#9f2f19]",
    },
    Cam: {
      wrapper: "border-[rgba(198,131,37,0.2)] bg-[rgba(255,247,233,0.92)]",
      title: "text-[#aa6b10]",
      pill: "bg-[rgba(198,131,37,0.12)] text-[#aa6b10]",
    },
    Xanh: {
      wrapper: "border-[rgba(118,129,105,0.2)] bg-[rgba(247,250,244,0.92)]",
      title: "text-[#4f6b49]",
      pill: "bg-[rgba(118,129,105,0.14)] text-[#4f6b49]",
    },
  };

  const levelOrder: Record<AlertItem["level"], number> = { Đỏ: 0, Cam: 1, Xanh: 2 };
  const sortedAlerts = [...alerts].sort((firstAlert, secondAlert) => levelOrder[firstAlert.level] - levelOrder[secondAlert.level]);

  function getAlertContext(caseId: string) {
    const caseItem = data.cases.find((item) => item.id === caseId);
    const customer = data.customers.find((item) => item.id === caseItem?.customerId);
    return {
      customerName: customer?.fullName ?? "Chưa xác định",
      serviceType: caseItem?.serviceType ?? "Chưa có dịch vụ",
    };
  }

  function getTaskContext(task: { caseId: string }) {
    const caseItem = data.cases.find((item) => item.id === task.caseId);
    const customer = data.customers.find((item) => item.id === caseItem?.customerId);
    return {
      customerName: customer?.fullName ?? "Chưa xác định",
      serviceType: caseItem?.serviceType ?? "Chưa có dịch vụ",
    };
  }

  const barData = [
    {
      name: "Đang xử lý",
      count: visibleCases.filter((caseItem) =>
        ["Đang chuẩn bị", "Đã nộp", "Đang giải quyết", "Chờ nộp thuế", "Mới tiếp nhận"].includes(caseItem.status)
      ).length,
      fill: "#c69835",
    },
    {
      name: "Chờ khách",
      count: visibleCases.filter((caseItem) =>
        ["Cần bổ sung", "Chờ khách cung cấp"].includes(caseItem.status)
      ).length,
      fill: "#d89f40",
    },
    {
      name: "Có kết quả",
      count: visibleCases.filter((caseItem) =>
        ["Có kết quả", "Đã nhận kết quả"].includes(caseItem.status)
      ).length,
      fill: "#8d7651",
    },
    {
      name: "Hoàn tất",
      count: visibleCases.filter((caseItem) => caseItem.status === "Hoàn tất").length,
      fill: "#6a7a55",
    },
    {
      name: "Vấn đề",
      count: visibleCases.filter((caseItem) =>
        ["Hồ sơ bị trả", "Đang khiếu nại", "Khách hủy"].includes(caseItem.status)
      ).length,
      fill: "#b15c45",
    },
  ];

  const serviceTypeMap = new Map<string, number>();
  visibleCases.forEach((caseItem) => {
    serviceTypeMap.set(caseItem.serviceType, (serviceTypeMap.get(caseItem.serviceType) ?? 0) + 1);
  });
  const pieData = Array.from(serviceTypeMap.entries())
    .sort((firstEntry, secondEntry) => secondEntry[1] - firstEntry[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  const pieColors = ["#c69835", "#e1bb70", "#8d7651", "#6a7a55", "#b15c45", "#d5a03e"];

  return (
    <div className="space-y-5 pb-4 md:space-y-6 md:pb-6">
      <section className="luxe-panel-strong rounded-[1.5rem] p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          {signalCards.map((item) => (
            <div key={item.label} className="rounded-[1.4rem] border border-[rgba(198,152,53,0.14)] bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--gold-700)]">
                {item.icon}
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">{item.label}</span>
              </div>
              <p className="mt-2 text-xl font-black text-[var(--text-main)]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <article key={card.label} className="luxe-card rounded-[1.55rem] p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.accent}`}>
                {card.icon}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                  {card.label}
                </p>
                <p className="mt-1 text-3xl font-black leading-none text-[var(--text-main)]">{card.value}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--text-soft)]">{card.note}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Phân bổ trạng thái hồ sơ" hint="Giúp nhìn nhanh nhóm hồ sơ đang ở đâu trong quy trình.">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barCategoryGap="26%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(198,152,53,0.12)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8b7758" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8b7758" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(198,152,53,0.06)" }}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(198,152,53,0.16)",
                      boxShadow: "0 18px 36px -26px rgba(110,76,17,0.32)",
                      background: "rgba(255,252,246,0.98)",
                    }}
                    formatter={(value: number) => [`${value} hồ sơ`, "Số lượng"]}
                  />
                  <Bar dataKey="count" radius={[12, 12, 4, 4]}>
                    {barData.map((entry, index) => (
                      <Cell key={`bar-${entry.name}-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {pieData.length > 0 ? (
            <SectionCard title="Cơ cấu theo dịch vụ" hint="Các loại hồ sơ nhiều nhất để cân bằng nguồn lực.">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`pie-${entry.name}-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid rgba(198,152,53,0.16)",
                        boxShadow: "0 18px 36px -26px rgba(110,76,17,0.32)",
                        background: "rgba(255,252,246,0.98)",
                      }}
                      formatter={(value: number, name: string) => [`${value} hồ sơ`, name]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 10, color: "#6f5d44" }}
                      formatter={(value) => (value.length > 18 ? `${value.slice(0, 18)}…` : value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-5">
          <SectionCard
            title="Cảnh báo ưu tiên"
            hint="Các hồ sơ nên mở lại trước để tránh trễ hoặc sót việc."
            action={
              alerts.length > 0 ? (
                <div className="luxe-badge rounded-full px-3 py-1 text-xs font-semibold">{alerts.length} mục</div>
              ) : null
            }
          >
            {sortedAlerts.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-[rgba(198,152,53,0.18)] bg-[rgba(255,251,243,0.7)] p-5 text-sm text-[var(--text-soft)]">
                Chưa có cảnh báo quan trọng nào trong hôm nay.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedAlerts.slice(0, 5).map((alert) => {
                  const context = getAlertContext(alert.caseId);
                  const tone = alertToneMap[alert.level];
                  return (
                    <button
                      key={alert.id}
                      onClick={() => navigate("case-detail", { caseId: alert.caseId })}
                      className={`w-full rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5 ${tone.wrapper}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.pill}`}>
                              {alert.level}
                            </span>
                            <span className={`truncate text-sm font-bold ${tone.title}`}>{alert.title}</span>
                          </div>
                          <p className="truncate text-sm text-[var(--text-main)]">{context.customerName}</p>
                          <p className="mt-1 truncate text-xs text-[var(--text-soft)]">{context.serviceType}</p>
                        </div>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-[var(--text-faint)]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Việc cần làm"
            hint="Những đầu việc đến hạn hoặc cần chạm tay ngay."
            action={
              myTasks.length > 0 ? (
                <button
                  onClick={() => navigate("tasks")}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--gold-700)] transition hover:bg-[rgba(255,248,231,0.86)]"
                >
                  Xem tất cả
                  <ChevronRight size={14} />
                </button>
              ) : null
            }
          >
            {myTasks.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-[rgba(198,152,53,0.18)] bg-[rgba(255,251,243,0.7)] p-5 text-sm text-[var(--text-soft)]">
                Hôm nay chưa có đầu việc đến hạn.
              </div>
            ) : (
              <div className="space-y-3">
                {myTasks.slice(0, 5).map((task) => {
                  const context = getTaskContext(task);
                  return (
                    <button
                      key={task.id}
                      onClick={() => navigate("case-detail", { caseId: task.caseId })}
                      className="luxe-card w-full rounded-[1.35rem] p-4 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(198,152,53,0.18)] bg-white text-[var(--gold-700)]">
                          <ClipboardList size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-bold text-[var(--text-main)]">{task.title}</p>
                            {task.dueTime ? (
                              <span className="shrink-0 rounded-full bg-[rgba(255,242,216,0.94)] px-2.5 py-1 text-[11px] font-semibold text-[var(--gold-700)]">
                                {task.dueTime}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-[var(--text-main)]">{context.customerName}</p>
                          <p className="mt-1 truncate text-xs text-[var(--text-soft)]">{context.serviceType}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <RecentCasesList recentCases={recentCases} data={data} navigate={navigate} />
    </div>
  );
}
