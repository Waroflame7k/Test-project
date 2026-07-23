"use client";

import { Fragment, useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
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

type FilterKey = "all" | "new" | "due-soon";
type SortMode = "deadline" | "status" | "customer" | "service" | "fee" | "received" | "receiving-agency";

const SORT_LABELS: Record<SortMode, string> = {
  deadline: "Hạn hồ sơ",
  status: "Trạng thái",
  customer: "Khách hàng",
  service: "Dịch vụ",
  fee: "Phí dịch vụ",
  received: "Ngày tạo",
  "receiving-agency": "Nơi nộp",
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "new", label: "Hồ sơ mới tạo" },
  { key: "due-soon", label: "Hồ sơ sắp hạn" },
];

const STATUS_ORDER = CASE_STATUSES.reduce((accumulator, status, index) => {
  accumulator[status] = index;
  return accumulator;
}, {} as Record<CaseStatus, number>);
const DELIVERED_TO_CUSTOMER_STATUS: CaseStatus = "Đã bàn giao khách";

function compareOptionalDate(first: string, second: string) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return first.localeCompare(second);
}

function receivingAgencyLabel(receivingAgency?: string) {
  return receivingAgency?.trim() || "Chưa có biên nhận";
}

function compareReceivingAgency(first: string, second: string) {
  if (first === "Chưa có biên nhận") return 1;
  if (second === "Chưa có biên nhận") return -1;
  return first.localeCompare(second, "vi");
}

function SortableColumnHeader({
  label,
  mode,
  activeMode,
  onSort,
}: {
  label: string;
  mode: SortMode;
  activeMode: SortMode;
  onSort: (mode: SortMode) => void;
}) {
  const isActive = activeMode === mode;

  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => onSort(mode)}
        aria-pressed={isActive}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] transition ${
          isActive ? "text-[var(--gold-700)]" : "text-[var(--text-faint)] hover:text-[var(--text-main)]"
        }`}
      >
        {label}
        {isActive ? <ChevronDown size={14} strokeWidth={2.5} /> : null}
      </button>
    </th>
  );
}

export function CasesScreen() {
  const { navigate, data, archiveCases, bulkUpdateCases, addActivityLog } = useApp();
  const currentUser = useCurrentUser();
  const allCases = useCases();
  const today = todayIso();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [sortMode, setSortMode] = useState<SortMode>("deadline");
  const [showDeliveredCases, setShowDeliveredCases] = useState(false);
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
    const latest = new Map<
      string,
      { submissionCode: string; submittedDate: string; expectedReturnDate: string; receivingAgency: string }
    >();
    data.submissions.forEach((submission) => {
      const current = latest.get(submission.caseId);
      if (!current || submission.submittedDate > current.submittedDate) {
        latest.set(submission.caseId, {
          submissionCode: submission.submissionCode,
          submittedDate: submission.submittedDate,
          expectedReturnDate: submission.expectedReturnDate,
          receivingAgency: submission.receivingAgency,
        });
      }
    });
    return latest;
  }, [data.submissions]);

  const returnDateFor = useCallback(
    (caseId: string, fallbackDate: string) => latestSubmissionMap.get(caseId)?.expectedReturnDate || fallbackDate,
    [latestSubmissionMap]
  );

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

    if (activeFilter === "new") {
      result = result.filter((caseItem) => !latestSubmissionMap.has(caseItem.id));
    } else if (activeFilter === "due-soon") {
      result = result.filter(
        (caseItem) => {
          const returnDate = returnDateFor(caseItem.id, caseItem.promisedDate);
          return Boolean(returnDate) && isCaseActive(caseItem.status) && isDueSoon(returnDate, today);
        }
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
      result = result.filter((caseItem) => returnDateFor(caseItem.id, caseItem.promisedDate) >= advanced.dateFrom);
    }
    if (advanced.dateTo) {
      result = result.filter((caseItem) => returnDateFor(caseItem.id, caseItem.promisedDate) <= advanced.dateTo);
    }

    const sorted = [...result];
    const keepDeliveredCasesSeparate = (items: typeof sorted) => {
      if (activeFilter !== "all") return items;
      return [
        ...items.filter((caseItem) => caseItem.status !== DELIVERED_TO_CUSTOMER_STATUS),
        ...items.filter((caseItem) => caseItem.status === DELIVERED_TO_CUSTOMER_STATUS),
      ];
    };

    switch (sortMode) {
      case "status":
        return keepDeliveredCasesSeparate(
          sorted.sort((firstCase, secondCase) => (STATUS_ORDER[firstCase.status] ?? 99) - (STATUS_ORDER[secondCase.status] ?? 99))
        );
      case "customer":
        return keepDeliveredCasesSeparate(
          sorted.sort((firstCase, secondCase) =>
            (customerMap.get(firstCase.customerId)?.fullName ?? "").localeCompare(
              customerMap.get(secondCase.customerId)?.fullName ?? ""
            )
          )
        );
      case "service":
        return keepDeliveredCasesSeparate(
          sorted.sort((firstCase, secondCase) => firstCase.serviceType.localeCompare(secondCase.serviceType, "vi"))
        );
      case "fee":
        return keepDeliveredCasesSeparate(sorted.sort((firstCase, secondCase) => secondCase.serviceFee - firstCase.serviceFee));
      case "received":
        return keepDeliveredCasesSeparate(sorted.sort((firstCase, secondCase) => secondCase.createdAt.localeCompare(firstCase.createdAt)));
      case "receiving-agency":
        return keepDeliveredCasesSeparate(
          sorted.sort((firstCase, secondCase) => {
            const agencyComparison = compareReceivingAgency(
              receivingAgencyLabel(latestSubmissionMap.get(firstCase.id)?.receivingAgency),
              receivingAgencyLabel(latestSubmissionMap.get(secondCase.id)?.receivingAgency)
            );
            if (agencyComparison !== 0) return agencyComparison;
            return compareOptionalDate(
              returnDateFor(firstCase.id, firstCase.promisedDate),
              returnDateFor(secondCase.id, secondCase.promisedDate)
            );
          })
        );
      default:
        return keepDeliveredCasesSeparate(
          sorted.sort((firstCase, secondCase) => {
            const firstDate = returnDateFor(firstCase.id, firstCase.promisedDate);
            const secondDate = returnDateFor(secondCase.id, secondCase.promisedDate);
            const firstRank = isOverdue(firstDate, today) ? 0 : isDueSoon(firstDate, today) ? 1 : firstDate ? 2 : 3;
            const secondRank = isOverdue(secondDate, today) ? 0 : isDueSoon(secondDate, today) ? 1 : secondDate ? 2 : 3;
            return firstRank - secondRank || compareOptionalDate(firstDate, secondDate);
          })
        );
    }
  }, [activeFilter, advanced, allCases, customerMap, deferredSearch, latestSubmissionMap, returnDateFor, sortMode, today]);

  const casesForList = useMemo(() => {
    if (activeFilter !== "all" || showDeliveredCases) return displayed;
    return displayed.filter((caseItem) => caseItem.status !== DELIVERED_TO_CUSTOMER_STATUS);
  }, [activeFilter, displayed, showDeliveredCases]);

  const receivingAgencyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    casesForList.forEach((caseItem) => {
      const agency = receivingAgencyLabel(latestSubmissionMap.get(caseItem.id)?.receivingAgency);
      counts.set(agency, (counts.get(agency) ?? 0) + 1);
    });
    return counts;
  }, [casesForList, latestSubmissionMap]);

  const deliveredCount = useMemo(
    () => displayed.filter((caseItem) => caseItem.status === DELIVERED_TO_CUSTOMER_STATUS).length,
    [displayed]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = casesForList.length > 0 && casesForList.every((caseItem) => selectedSet.has(caseItem.id));

  const summaryCards = [
    { label: "Tổng hồ sơ", value: allCases.length },
    { label: "Đang xử lý", value: allCases.filter((caseItem) => isCaseActive(caseItem.status)).length },
    { label: "Chưa có biên nhận", value: allCases.filter((caseItem) => !latestSubmissionMap.has(caseItem.id)).length },
    {
      label: "Quá hạn",
      value: allCases.filter(
        (caseItem) => {
          const returnDate = returnDateFor(caseItem.id, caseItem.promisedDate);
          return Boolean(returnDate) && isCaseActive(caseItem.status) && isOverdue(returnDate, today);
        }
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
    if (casesForList.length === 0) return;
    const visibleIds = casesForList.map((caseItem) => caseItem.id);
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
    <div className="space-y-3 pb-2 md:space-y-6 md:pb-6">
      <section className="luxe-panel-strong rounded-[1.1rem] p-3 md:rounded-[1.4rem] md:p-5">
        <div className="flex flex-col gap-2 md:gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {(canBulkUpdate || canArchive) && (
              <button
                onClick={() => (batchMode ? exitBatchMode() : setBatchMode(true))}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition md:rounded-2xl md:px-4 md:py-2.5 md:text-sm ${
                  batchMode ? "luxe-button-primary" : "luxe-button-secondary"
                }`}
              >
                {batchMode ? "Tắt chọn nhiều" : "Chọn nhiều"}
              </button>
            )}

            {canCreateReceipt && (
              <button
                onClick={() => navigate("scan-receipt")}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold luxe-button-secondary md:gap-2 md:rounded-2xl md:px-4 md:py-2.5 md:text-sm"
              >
                <ScanText size={16} />
                Tạo biên nhận hồ sơ
              </button>
            )}

            {canCreateCustomerProfile && (
              <button
                onClick={() => navigate("create-case")}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold luxe-button-primary md:gap-2 md:rounded-2xl md:px-4 md:py-2.5 md:text-sm"
              >
                <Plus size={16} />
                Tạo hồ sơ khách hàng
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2 md:mt-5 md:gap-3 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <div key={item.label} className="rounded-xl border border-[rgba(198,152,53,0.12)] bg-white px-3 py-2 md:rounded-[1.3rem] md:px-4 md:py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-faint)] md:text-xs md:tracking-[0.16em]">{item.label}</p>
              <p className="mt-1 text-xl font-black text-[var(--text-main)] md:mt-2 md:text-2xl">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="luxe-panel rounded-[1.1rem] p-3 md:rounded-[1.8rem] md:p-5">
        <div className="flex flex-col gap-2 md:gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[rgba(198,152,53,0.14)] bg-white px-3 py-2.5 md:rounded-2xl md:px-4 md:py-3">
            <Search size={16} className="shrink-0 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder="Tìm theo khách hàng, mã hồ sơ, biên nhận hoặc dịch vụ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>

          <div className="flex gap-2 md:justify-end md:gap-3">
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="luxe-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs outline-none md:min-w-[220px] md:flex-none md:px-4 md:py-3 md:text-sm"
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  Sắp xếp theo {SORT_LABELS[mode]}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowAdvanced((previous) => !previous)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition md:gap-2 md:rounded-2xl md:px-4 md:py-3 md:text-sm ${
                showAdvanced || hasAdvancedFilter ? "luxe-button-primary" : "luxe-button-secondary"
              }`}
            >
              <SlidersHorizontal size={16} />
              Bộ lọc
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 md:mt-4 md:gap-2 md:pb-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition md:px-4 md:py-2 md:text-sm ${
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

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-soft)] md:mt-4 md:gap-2 md:text-sm">
          <span>{casesForList.length} hồ sơ hiển thị</span>
          <span className="text-[var(--border-strong)]">•</span>
          <span>Sắp xếp theo {SORT_LABELS[sortMode]}</span>
          {activeFilter === "all" && deliveredCount > 0 ? (
            <>
              <span className="text-[var(--border-strong)]">•</span>
              <button
                type="button"
                onClick={() => setShowDeliveredCases((previous) => !previous)}
                className="inline-flex items-center gap-1 font-semibold text-[var(--gold-700)]"
              >
                Hồ sơ đã bàn giao khách ({deliveredCount})
                <ChevronDown size={14} className={showDeliveredCases ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
            </>
          ) : null}
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
        {casesForList.length === 0 ? (
          <EmptyState title="Không có hồ sơ" message="Thử đổi bộ lọc hoặc tạo hồ sơ khách hàng mới." />
        ) : (
          <div className="luxe-panel rounded-[1.8rem] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[rgba(251,246,236,0.7)]">
                <tr className="border-b border-[rgba(198,152,53,0.1)] text-left">
                  {batchMode ? <th className="px-4 py-3 w-12" /> : null}
                  <SortableColumnHeader label="Khách hàng" mode="customer" activeMode={sortMode} onSort={setSortMode} />
                  <SortableColumnHeader label="Dịch vụ" mode="service" activeMode={sortMode} onSort={setSortMode} />
                  <SortableColumnHeader label="Trạng thái" mode="status" activeMode={sortMode} onSort={setSortMode} />
                  <SortableColumnHeader label="Hạn hồ sơ" mode="deadline" activeMode={sortMode} onSort={setSortMode} />
                  <SortableColumnHeader label="Nơi nộp" mode="receiving-agency" activeMode={sortMode} onSort={setSortMode} />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Phụ trách</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Phí</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Biên nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(198,152,53,0.08)]">
                {casesForList.map((caseItem, index) => {
                  const customer = customerMap.get(caseItem.customerId);
                  const assignedProfile = profileMap.get(caseItem.assignedTo);
                  const latestSubmission = latestSubmissionMap.get(caseItem.id);
                  const receivingAgency = receivingAgencyLabel(latestSubmission?.receivingAgency);
                  const previousAgency = index > 0
                    ? receivingAgencyLabel(latestSubmissionMap.get(casesForList[index - 1].id)?.receivingAgency)
                    : null;
                  const isDelivered = caseItem.status === DELIVERED_TO_CUSTOMER_STATUS;
                  const previousIsDelivered = index > 0 && casesForList[index - 1].status === DELIVERED_TO_CUSTOMER_STATUS;
                  const showDeliveredSection = activeFilter === "all" && isDelivered && !previousIsDelivered;
                  const showAgencyGroup =
                    sortMode === "receiving-agency" && (receivingAgency !== previousAgency || showDeliveredSection);
                  const returnDate = returnDateFor(caseItem.id, caseItem.promisedDate);
                  const overdue = Boolean(returnDate) && isOverdue(returnDate, today);
                  const dueSoon = Boolean(returnDate) && !overdue && isDueSoon(returnDate, today);

                  return (
                    <Fragment key={caseItem.id}>
                      {showDeliveredSection ? (
                        <tr className="border-y-2 border-[rgba(198,152,53,0.3)] bg-[rgba(255,249,238,0.94)]">
                          <td colSpan={batchMode ? 9 : 8} className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--gold-700)]">Hồ sơ đã bàn giao khách</span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--text-soft)]">
                                {deliveredCount}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {showAgencyGroup ? (
                        <tr className="border-y border-[rgba(198,152,53,0.12)] bg-[rgba(251,246,236,0.78)]">
                          <td colSpan={batchMode ? 9 : 8} className="px-4 py-2.5">
                            <span className="font-semibold text-[var(--text-main)]">{receivingAgency}</span>
                            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--text-soft)]">
                              {receivingAgencyCounts.get(receivingAgency)}
                            </span>
                          </td>
                        </tr>
                      ) : null}
                      <tr
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
                        {returnDate ? (
                          <span className={overdue ? "font-semibold text-[#b15c45]" : dueSoon ? "font-semibold text-[#b97316]" : "text-[var(--text-main)]"}>
                            {formatDate(returnDate)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-soft)]">Chưa hẹn trả</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-[var(--text-main)]">{receivingAgency}</td>

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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2 md:hidden">
        {casesForList.length === 0 ? (
          <EmptyState title="Không có hồ sơ" message="Thử đổi bộ lọc hoặc tạo hồ sơ khách hàng mới." />
        ) : (
          casesForList.map((caseItem, index) => {
            const customer = customerMap.get(caseItem.customerId);
            const latestSubmission = latestSubmissionMap.get(caseItem.id);
            const receivingAgency = receivingAgencyLabel(latestSubmission?.receivingAgency);
            const previousAgency = index > 0
              ? receivingAgencyLabel(latestSubmissionMap.get(casesForList[index - 1].id)?.receivingAgency)
              : null;
            const isDelivered = caseItem.status === DELIVERED_TO_CUSTOMER_STATUS;
            const previousIsDelivered = index > 0 && casesForList[index - 1].status === DELIVERED_TO_CUSTOMER_STATUS;
            const showDeliveredSection = activeFilter === "all" && isDelivered && !previousIsDelivered;
            const showAgencyGroup =
              sortMode === "receiving-agency" && (receivingAgency !== previousAgency || showDeliveredSection);
            const returnDate = returnDateFor(caseItem.id, caseItem.promisedDate);
            const overdue = Boolean(returnDate) && isOverdue(returnDate, today);
            const dueSoon = Boolean(returnDate) && !overdue && isDueSoon(returnDate, today);

            return (
              <div key={caseItem.id}>
                {showDeliveredSection ? (
                  <div className="flex items-center gap-2 px-1 pb-1 pt-4">
                    <span className="text-sm font-bold text-[var(--gold-700)]">Hồ sơ đã bàn giao khách</span>
                    <span className="rounded-full bg-[rgba(255,249,238,0.95)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-soft)]">
                      {deliveredCount}
                    </span>
                  </div>
                ) : null}
                {showAgencyGroup ? (
                  <div className="flex items-center gap-2 px-1 pb-1 pt-3 first:pt-0">
                    <span className="truncate text-sm font-bold text-[var(--text-main)]">{receivingAgency}</span>
                    <span className="rounded-full bg-[rgba(251,246,236,0.95)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-soft)]">
                      {receivingAgencyCounts.get(receivingAgency)}
                    </span>
                  </div>
                ) : null}
                <button
                  onClick={() => !batchMode && navigate("case-detail", { caseId: caseItem.id })}
                  className="luxe-card w-full rounded-[1.1rem] p-3 text-left"
                >
                <div className="flex gap-2.5">
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

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(198,152,53,0.14)] bg-white text-[var(--gold-700)]">
                    <FileText size={19} />
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

                    <p className="mt-0.5 truncate text-xs text-[var(--text-main)]">{caseItem.serviceType}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--text-soft)]">
                      <Calendar size={12} />
                      <span>{returnDate ? `Hẹn trả ${formatDate(returnDate)}` : "Chưa hẹn trả"}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge status={caseItem.status} />
                      <span className="truncate text-[11px] font-semibold text-[var(--text-soft)]">
                        {latestSubmission ? latestSubmission.submissionCode : "Chưa có biên nhận"}
                      </span>
                    </div>
                  </div>
                </div>
                </button>
              </div>
            );
          })
        )}
      </section>

      {!batchMode && (
        <div className="fixed bottom-16 left-2 right-2 z-10 grid grid-cols-2 gap-2 md:hidden">
          {canCreateReceipt ? (
            <button
              onClick={() => navigate("scan-receipt")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold shadow-lg luxe-button-secondary"
            >
              <ScanText size={17} />
              Tạo biên nhận
            </button>
          ) : null}

          {canCreateCustomerProfile ? (
            <button
              onClick={() => navigate("create-case")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold shadow-lg luxe-button-primary"
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
