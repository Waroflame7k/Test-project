"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  FileText,
  Plus,
  ScanText,
  Search,
  Settings2,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useApp, useCurrentUser, useCases } from "@/features/app-shell/app-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { CASE_STATUSES } from "@/lib/constants";
import { formatDate, isDueSoon, isOverdue, todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { isCaseActive } from "@/lib/case-utils";
import { can } from "@/lib/permissions";
import type { CaseStatus, Priority } from "@/types/domain";

interface AdvancedFilters {
  serviceType: string;
  assignedTo: string;
  dateFrom: string;
  dateTo: string;
}

type FilterKey = "all" | "active" | "waiting-receipt" | "due-soon" | "overdue";
type SortMode = "deadline" | "status" | "customer" | "fee" | "received";

const SORT_LABELS: Record<SortMode, string> = {
  deadline: "Hẹn trả",
  status: "Trạng thái",
  customer: "Khách hàng",
  fee: "Phí dịch vụ",
  received: "Ngày tạo",
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang xử lý" },
  { key: "waiting-receipt", label: "Chưa có biên nhận" },
  { key: "due-soon", label: "Sắp hạn" },
  { key: "overdue", label: "Quá hạn" },
];

const STATUS_ORDER = CASE_STATUSES.reduce((accumulator, status, index) => {
  accumulator[status] = index;
  return accumulator;
}, {} as Record<CaseStatus, number>);

function compareOptionalDate(first: string, second: string) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return first.localeCompare(second);
}

export function CasesScreen() {
  const { navigate, data, archiveCases, bulkUpdateCases, addActivityLog } = useApp();
  const currentUser = useCurrentUser();
  const allCases = useCases();
  const today = todayIso();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [sortMode, setSortMode] = useState<SortMode>("deadline");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedFilters>({
    serviceType: "",
    assignedTo: "",
    dateFrom: "",
    dateTo: "",
  });

  const deferredSearch = useDeferredValue(search);
  const canCreateCustomerProfile = can(currentUser.role, "view_all_cases");
  const canCreateReceipt = can(currentUser.role, "add_submissions");
  const canAssign = can(currentUser.role, "assign_staff");
  const canBulkUpdate = can(currentUser.role, "update_progress") || canAssign;
  const canArchive = can(currentUser.role, "delete_case");

  const customerMap = useMemo(() => new Map(data.customers.map((customer) => [customer.id, customer])), [data.customers]);
  const profileMap = useMemo(() => new Map(data.profiles.map((profile) => [profile.id, profile])), [data.profiles]);
  const latestSubmissionMap = useMemo(() => {
    const latest = new Map<string, { submissionCode: string; submittedDate: string }>();
    data.submissions.forEach((submission) => {
      const current = latest.get(submission.caseId);
      if (!current || submission.submittedDate > current.submittedDate) {
        latest.set(submission.caseId, {
          submissionCode: submission.submissionCode,
          submittedDate: submission.submittedDate,
        });
      }
    });
    return latest;
  }, [data.submissions]);

  const serviceTypes = useMemo(() => [...new Set(allCases.map((caseItem) => caseItem.serviceType))].sort(), [allCases]);
  const staffList = useMemo(() => {
    return data.profiles
      .filter((profile) => profile.role === "legal_staff" || profile.role === "manager" || profile.role === "admin")
      .sort((firstProfile, secondProfile) => firstProfile.fullName.localeCompare(secondProfile.fullName));
  }, [data.profiles]);

  const hasAdvancedFilter =
    advanced.serviceType !== "" || advanced.assignedTo !== "" || advanced.dateFrom !== "" || advanced.dateTo !== "";

  const displayed = useMemo(() => {
    let result = allCases;

    if (activeFilter === "active") {
      result = result.filter((caseItem) => isCaseActive(caseItem.status));
    } else if (activeFilter === "waiting-receipt") {
      result = result.filter((caseItem) => !latestSubmissionMap.has(caseItem.id));
    } else if (activeFilter === "due-soon") {
      result = result.filter(
        (caseItem) => Boolean(caseItem.promisedDate) && isCaseActive(caseItem.status) && isDueSoon(caseItem.promisedDate, today)
      );
    } else if (activeFilter === "overdue") {
      result = result.filter(
        (caseItem) => Boolean(caseItem.promisedDate) && isCaseActive(caseItem.status) && isOverdue(caseItem.promisedDate, today)
      );
    }

    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase();
      result = result.filter((caseItem) => {
        const customer = customerMap.get(caseItem.customerId);
        const latestSubmission = latestSubmissionMap.get(caseItem.id);
        return (
          caseItem.serviceType.toLowerCase().includes(query) ||
          caseItem.caseCode.toLowerCase().includes(query) ||
          customer?.fullName.toLowerCase().includes(query) ||
          customer?.phone.includes(query) ||
          latestSubmission?.submissionCode.toLowerCase().includes(query)
        );
      });
    }

    if (advanced.serviceType) {
      result = result.filter((caseItem) => caseItem.serviceType === advanced.serviceType);
    }
    if (advanced.assignedTo) {
      result = result.filter((caseItem) => caseItem.assignedTo === advanced.assignedTo);
    }
    if (advanced.dateFrom) {
      result = result.filter((caseItem) => caseItem.promisedDate && caseItem.promisedDate >= advanced.dateFrom);
    }
    if (advanced.dateTo) {
      result = result.filter((caseItem) => caseItem.promisedDate && caseItem.promisedDate <= advanced.dateTo);
    }

    const sorted = [...result];
    switch (sortMode) {
      case "status":
        return sorted.sort((firstCase, secondCase) => (STATUS_ORDER[firstCase.status] ?? 99) - (STATUS_ORDER[secondCase.status] ?? 99));
      case "customer":
        return sorted.sort((firstCase, secondCase) =>
          (customerMap.get(firstCase.customerId)?.fullName ?? "").localeCompare(
            customerMap.get(secondCase.customerId)?.fullName ?? ""
          )
        );
      case "fee":
        return sorted.sort((firstCase, secondCase) => secondCase.serviceFee - firstCase.serviceFee);
      case "received":
        return sorted.sort((firstCase, secondCase) => secondCase.createdAt.localeCompare(firstCase.createdAt));
      default:
        return sorted.sort((firstCase, secondCase) => compareOptionalDate(firstCase.promisedDate, secondCase.promisedDate));
    }
  }, [activeFilter, advanced, allCases, customerMap, deferredSearch, latestSubmissionMap, sortMode, today]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = displayed.length > 0 && displayed.every((caseItem) => selectedSet.has(caseItem.id));

  const summaryCards = [
    { label: "Tổng hồ sơ", value: allCases.length },
    { label: "Đang xử lý", value: allCases.filter((caseItem) => isCaseActive(caseItem.status)).length },
    { label: "Chưa có biên nhận", value: allCases.filter((caseItem) => !latestSubmissionMap.has(caseItem.id)).length },
    {
      label: "Quá hạn",
      value: allCases.filter(
        (caseItem) => Boolean(caseItem.promisedDate) && isCaseActive(caseItem.status) && isOverdue(caseItem.promisedDate, today)
      ).length,
    },
  ];

  function clearAdvanced() {
    setAdvanced({ serviceType: "", assignedTo: "", dateFrom: "", dateTo: "" });
  }

  function toggleSelect(caseId: string) {
    setSelectedIds((previous) => (previous.includes(caseId) ? previous.filter((id) => id !== caseId) : [...previous, caseId]));
  }

  function toggleSelectAllVisible() {
    if (displayed.length === 0) return;
    const visibleIds = displayed.map((caseItem) => caseItem.id);
    if (allVisibleSelected) {
      setSelectedIds((previous) => previous.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds(Array.from(new Set([...selectedIds, ...visibleIds])));
  }

  function exitBatchMode() {
    setBatchMode(false);
    setSelectedIds([]);
  }

  function archiveSelectedCases() {
    if (!canArchive || selectedIds.length === 0) return;
    archiveCases(selectedIds);
    selectedIds.forEach((caseId) => {
      addActivityLog({
        organizationId: currentUser.organizationId,
        caseId,
        actorId: currentUser.id,
        action: "Xóa mềm hồ sơ",
        entityType: "cases",
        entityId: caseId,
      });
    });
    exitBatchMode();
  }

  function handleBulkEdit(values: {
    status?: CaseStatus;
    assignedTo?: string;
    priority?: Priority;
  }) {
    if (selectedIds.length === 0) return;
    bulkUpdateCases(selectedIds, values);
    selectedIds.forEach((caseId) => {
      addActivityLog({
        organizationId: currentUser.organizationId,
        caseId,
        actorId: currentUser.id,
        action: "Cập nhật hàng loạt",
        entityType: "cases",
        entityId: caseId,
        newValue: [values.status, values.assignedTo, values.priority].filter(Boolean).join(" · "),
      });
    });
    setBulkEditOpen(false);
    exitBatchMode();
  }

  return (
    <div className="space-y-5 pb-6 md:space-y-6">
      <section className="luxe-panel-strong rounded-[1.4rem] p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {(canBulkUpdate || canArchive) && (
              <button
                onClick={() => (batchMode ? exitBatchMode() : setBatchMode(true))}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  batchMode ? "luxe-button-primary" : "luxe-button-secondary"
                }`}
              >
                {batchMode ? "Tắt chọn nhiều" : "Chọn nhiều"}
              </button>
            )}

            {canCreateReceipt && (
              <button
                onClick={() => navigate("scan-receipt")}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold luxe-button-secondary"
              >
                <ScanText size={16} />
                Tạo biên nhận hồ sơ
              </button>
            )}

            {canCreateCustomerProfile && (
              <button
                onClick={() => navigate("create-case")}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold luxe-button-primary"
              >
                <Plus size={16} />
                Tạo hồ sơ khách hàng
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <div key={item.label} className="rounded-[1.3rem] border border-[rgba(198,152,53,0.12)] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-[var(--text-main)]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="luxe-panel rounded-[1.8rem] p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[rgba(198,152,53,0.14)] bg-white px-4 py-3">
            <Search size={16} className="shrink-0 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder="Tìm theo khách hàng, mã hồ sơ, biên nhận hoặc dịch vụ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] xl:w-[360px]">
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="luxe-input rounded-2xl px-4 py-3 text-sm outline-none"
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  Sắp xếp theo {SORT_LABELS[mode]}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowAdvanced((previous) => !previous)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                showAdvanced || hasAdvancedFilter ? "luxe-button-primary" : "luxe-button-secondary"
              }`}
            >
              <SlidersHorizontal size={16} />
              Bộ lọc
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeFilter === filter.key
                  ? "border border-[rgba(198,152,53,0.2)] bg-[rgba(255,249,238,0.95)] text-[var(--gold-700)]"
                  : "border border-transparent bg-white text-[var(--text-soft)] hover:border-[rgba(198,152,53,0.14)]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {showAdvanced && (
          <div className="mt-4 grid gap-3 rounded-[1.5rem] border border-[rgba(198,152,53,0.12)] bg-white p-4 md:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                Dịch vụ
              </span>
              <select
                value={advanced.serviceType}
                onChange={(event) => setAdvanced({ ...advanced, serviceType: event.target.value })}
                className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Tất cả</option>
                {serviceTypes.map((serviceType) => (
                  <option key={serviceType} value={serviceType}>
                    {serviceType}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                Người phụ trách
              </span>
              <select
                value={advanced.assignedTo}
                onChange={(event) => setAdvanced({ ...advanced, assignedTo: event.target.value })}
                className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Tất cả</option>
                {staffList.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                Hẹn trả từ
              </span>
              <input
                type="date"
                value={advanced.dateFrom}
                onChange={(event) => setAdvanced({ ...advanced, dateFrom: event.target.value })}
                className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                Hẹn trả đến
              </span>
              <input
                type="date"
                value={advanced.dateTo}
                onChange={(event) => setAdvanced({ ...advanced, dateTo: event.target.value })}
                className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-soft)]">
          <span>{displayed.length} hồ sơ hiển thị</span>
          <span className="text-[var(--border-strong)]">•</span>
          <span>Sắp xếp theo {SORT_LABELS[sortMode]}</span>
          {hasAdvancedFilter ? (
            <>
              <span className="text-[var(--border-strong)]">•</span>
              <button onClick={clearAdvanced} className="inline-flex items-center gap-1 font-semibold text-[#b15c45]">
                <X size={14} />
                Xóa bộ lọc
              </button>
            </>
          ) : null}
        </div>
      </section>

      {batchMode ? (
        <section className="luxe-panel rounded-[1.6rem] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleSelectAllVisible}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(198,152,53,0.14)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text-main)]"
            >
              {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              Chọn tất cả đang hiển thị
            </button>

            <span className="text-sm font-semibold text-[var(--text-main)]">{selectedIds.length} hồ sơ được chọn</span>
            <span className="flex-1" />

            {canBulkUpdate && (
              <button
                onClick={() => setBulkEditOpen(true)}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold luxe-button-secondary disabled:opacity-50"
              >
                <Settings2 size={15} />
                Tùy chỉnh hàng loạt
              </button>
            )}

            {canArchive && (
              <button
                onClick={archiveSelectedCases}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[#b15c45] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Trash2 size={15} />
                Xóa hàng loạt
              </button>
            )}
          </div>
        </section>
      ) : null}

      <section className="hidden md:block">
        {displayed.length === 0 ? (
          <EmptyState title="Không có hồ sơ" message="Thử đổi bộ lọc hoặc tạo hồ sơ khách hàng mới." />
        ) : (
          <div className="luxe-panel rounded-[1.8rem] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[rgba(251,246,236,0.7)]">
                <tr className="border-b border-[rgba(198,152,53,0.1)] text-left">
                  {batchMode ? <th className="px-4 py-3 w-12" /> : null}
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Khách hàng</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Dịch vụ</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Trạng thái</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Hẹn trả</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Phụ trách</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Phí</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Biên nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(198,152,53,0.08)]">
                {displayed.map((caseItem) => {
                  const customer = customerMap.get(caseItem.customerId);
                  const assignedProfile = profileMap.get(caseItem.assignedTo);
                  const latestSubmission = latestSubmissionMap.get(caseItem.id);
                  const overdue = Boolean(caseItem.promisedDate) && isOverdue(caseItem.promisedDate, today);
                  const dueSoon = Boolean(caseItem.promisedDate) && !overdue && isDueSoon(caseItem.promisedDate, today);

                  return (
                    <tr
                      key={caseItem.id}
                      onClick={() => !batchMode && navigate("case-detail", { caseId: caseItem.id })}
                      className={`transition ${batchMode ? "hover:bg-[rgba(255,249,240,0.55)]" : "cursor-pointer hover:bg-[rgba(255,249,240,0.42)]"}`}
                    >
                      {batchMode ? (
                        <td className="px-4 py-3">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelect(caseItem.id);
                            }}
                            className="text-[var(--gold-700)]"
                          >
                            {selectedSet.has(caseItem.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                      ) : null}

                      <td className="px-4 py-3">
                        <p className="font-bold text-[var(--text-main)]">{customer?.fullName ?? "Chưa có khách hàng"}</p>
                        <p className="text-xs text-[var(--text-soft)]">{customer?.phone ?? ""}</p>
                      </td>

                      <td className="px-4 py-3 text-[var(--text-main)]">{caseItem.serviceType}</td>
                      <td className="px-4 py-3"><StatusBadge status={caseItem.status} /></td>

                      <td className="px-4 py-3">
                        {caseItem.promisedDate ? (
                          <span className={overdue ? "font-semibold text-[#b15c45]" : dueSoon ? "font-semibold text-[#b97316]" : "text-[var(--text-main)]"}>
                            {formatDate(caseItem.promisedDate)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-soft)]">Chưa hẹn trả</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-[var(--text-main)]">{assignedProfile?.fullName ?? "Chưa phân công"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text-main)]">{formatVnd(caseItem.serviceFee)}</td>
                      <td className="px-4 py-3">
                        {latestSubmission ? (
                          <span className="inline-flex rounded-full border border-[rgba(198,152,53,0.16)] bg-white px-2.5 py-1 font-mono text-xs text-[var(--gold-700)]">
                            {latestSubmission.submissionCode}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-soft)]">Chưa có biên nhận</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 md:hidden">
        {displayed.length === 0 ? (
          <EmptyState title="Không có hồ sơ" message="Thử đổi bộ lọc hoặc tạo hồ sơ khách hàng mới." />
        ) : (
          displayed.map((caseItem) => {
            const customer = customerMap.get(caseItem.customerId);
            const latestSubmission = latestSubmissionMap.get(caseItem.id);
            const overdue = Boolean(caseItem.promisedDate) && isOverdue(caseItem.promisedDate, today);
            const dueSoon = Boolean(caseItem.promisedDate) && !overdue && isDueSoon(caseItem.promisedDate, today);

            return (
              <button
                key={caseItem.id}
                onClick={() => !batchMode && navigate("case-detail", { caseId: caseItem.id })}
                className="luxe-card w-full rounded-[1.5rem] p-4 text-left"
              >
                <div className="flex gap-3">
                  {batchMode ? (
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelect(caseItem.id);
                      }}
                      className="pt-1 text-[var(--gold-700)]"
                    >
                      {selectedSet.has(caseItem.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </span>
                  ) : null}

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(198,152,53,0.14)] bg-white text-[var(--gold-700)]">
                    <FileText size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-bold text-[var(--text-main)]">{customer?.fullName ?? "Chưa có khách hàng"}</p>
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,239,234,0.9)] px-2 py-1 text-[10px] font-semibold text-[#b15c45]">
                          <AlertTriangle size={10} />
                          Quá hạn
                        </span>
                      ) : dueSoon ? (
                        <span className="rounded-full bg-[rgba(255,247,231,0.95)] px-2 py-1 text-[10px] font-semibold text-[#b97316]">
                          Sắp hạn
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 truncate text-sm text-[var(--text-main)]">{caseItem.serviceType}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-soft)]">
                      <Calendar size={12} />
                      <span>{caseItem.promisedDate ? `Hẹn trả ${formatDate(caseItem.promisedDate)}` : "Chưa hẹn trả"}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <StatusBadge status={caseItem.status} />
                      <span className="text-xs font-semibold text-[var(--text-soft)]">
                        {latestSubmission ? latestSubmission.submissionCode : "Chưa có biên nhận"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </section>

      {!batchMode && (
        <div className="fixed bottom-24 left-4 right-4 z-10 grid grid-cols-2 gap-3 md:hidden">
          {canCreateReceipt ? (
            <button
              onClick={() => navigate("scan-receipt")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg luxe-button-secondary"
            >
              <ScanText size={17} />
              Tạo biên nhận
            </button>
          ) : null}

          {canCreateCustomerProfile ? (
            <button
              onClick={() => navigate("create-case")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg luxe-button-primary"
            >
              <Plus size={17} />
              Tạo hồ sơ
            </button>
          ) : null}
        </div>
      )}

      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        profiles={staffList}
        canAssign={canAssign}
        onSubmit={handleBulkEdit}
      />
    </div>
  );
}

function BulkEditModal({
  open,
  onClose,
  profiles,
  canAssign,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  profiles: Array<{ id: string; fullName: string }>;
  canAssign: boolean;
  onSubmit: (values: { status?: CaseStatus; assignedTo?: string; priority?: Priority }) => void;
}) {
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Tùy chỉnh hàng loạt">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Trạng thái mới
          </span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            <option value="">Giữ nguyên</option>
            {CASE_STATUSES.map((caseStatus) => (
              <option key={caseStatus} value={caseStatus}>
                {caseStatus}
              </option>
            ))}
          </select>
        </label>

        {canAssign ? (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
              Phân công lại
            </span>
            <select
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Giữ nguyên</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.fullName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Ưu tiên
          </span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="luxe-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          >
            <option value="">Giữ nguyên</option>
            {(["Thấp", "Trung bình", "Cao", "Khẩn"] as Priority[]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => {
            if (!status && !assignedTo && !priority) return;
            onSubmit({
              status: status ? (status as CaseStatus) : undefined,
              assignedTo: assignedTo || undefined,
              priority: priority ? (priority as Priority) : undefined,
            });
            setStatus("");
            setAssignedTo("");
            setPriority("");
          }}
          className="w-full rounded-xl py-3 text-sm font-bold luxe-button-primary disabled:opacity-50"
          disabled={!status && !assignedTo && !priority}
        >
          Áp dụng
        </button>
      </div>
    </Modal>
  );
}
