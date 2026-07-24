"use client";

import { useState } from "react";
import {
  Info,
  FileCheck,
  FolderOpen,
  ClipboardCheck,
  DollarSign,
  History,
  User,
  Calendar,
  Building2,
  RefreshCw,
  Plus,
  CheckCircle,
  Circle,
  Lock,
  ArrowRightLeft,
  Camera,
  Pencil,
  Trash2,
} from "lucide-react";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { paidByCustomer, receivableForCase } from "@/lib/case-utils";
import { can } from "@/lib/permissions";
import { CASE_STATUSES } from "@/lib/constants";
import type { Case, CaseStatus, CustodyTransfer, DocumentRecord, PaymentType, Priority, SubmissionStatus, TaskStatus } from "@/types/domain";

const TRANSFER_TYPES: CustodyTransfer["transferType"][] = [
  "Nhận từ khách",
  "Bàn giao nội bộ",
  "Mang đi nộp",
  "Nhận lại",
  "Bàn giao khách",
];

const TABS = [
  { key: "info", label: "Thông tin", icon: <Info size={16} /> },
  { key: "submissions", label: "Lần nộp", icon: <FileCheck size={16} /> },
  { key: "documents", label: "Tài liệu", icon: <FolderOpen size={16} /> },
  { key: "tasks", label: "Công việc", icon: <ClipboardCheck size={16} /> },
  { key: "payments", label: "Thu chi", icon: <DollarSign size={16} /> },
  { key: "history", label: "Lịch sử", icon: <History size={16} /> },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function CaseDetailScreen({ caseId, initialTab }: { caseId: string; initialTab?: TabKey }) {
  const { data, navigate, updateCase, archiveCase, addSubmission, deleteSubmission, addTask, completeTask, deleteTask, addPayment, deletePayment, addDocument, updateDocument, deleteDocument, addCustodyTransfer, addActivityLog } =
    useApp();
  const currentUser = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "info");
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | "">("");
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferDocId, setTransferDocId] = useState("");
  const [editingDocument, setEditingDocument] = useState<DocumentRecord | null>(null);

  const maybeCase = data.cases.find((c) => c.id === caseId && !c.archivedAt);
  if (!maybeCase) {
    return (
      <EmptyState title="Không tìm thấy hồ sơ" message="Hồ sơ này không tồn tại hoặc đã bị xóa." />
    );
  }
  // Captured after null check — gives closures a non-nullable reference
  const caseItem: Case = maybeCase;

  const customer = data.customers.find((c) => c.id === caseItem.customerId);
  const assignedProfile = data.profiles.find((p) => p.id === caseItem.assignedTo);
  const caseProperties = data.caseProperties
    .filter((cp) => cp.caseId === caseId)
    .map((cp) => data.properties.find((p) => p.id === cp.propertyId))
    .filter(Boolean);

  const caseSubmissions = data.submissions.filter((s) => s.caseId === caseId);
  const receiptImageSubmissions = caseSubmissions.filter((submission) => Boolean(submission.receiptImageUrl));
  const caseDocuments = data.documents.filter((d) => d.caseId === caseId);
  const originalDocuments = caseDocuments.filter((document) => document.originalOrCopy === "Bản chính");
  const caseTasks = data.tasks.filter((t) => t.caseId === caseId);
  const casePayments = data.payments.filter((p) => p.caseId === caseId);
  const caseActivityLogs = data.activityLogs.filter((l) => l.caseId === caseId);
  const caseDocIds = new Set(caseDocuments.map((d) => d.id));
  const caseCustodyTransfers = data.custodyTransfers.filter((ct) => caseDocIds.has(ct.documentId));

  const paid = paidByCustomer(caseId, data.payments);
  const spent = casePayments.filter((payment) => payment.paymentType === "Chi").reduce((sum, payment) => sum + payment.amount, 0);
  const receivable = receivableForCase(caseItem, data.payments);

  const canUpdateProgress = can(currentUser.role, "update_progress");
  const canAddSubmission = can(currentUser.role, "add_submissions");
  const canAddDocument = can(currentUser.role, "add_documents");
  const canViewFinance = can(currentUser.role, "view_finance");
  const canEditFinance = can(currentUser.role, "edit_finance");
  const canCompleteTasks = can(currentUser.role, "complete_tasks");
  const canDeleteCase = can(currentUser.role, "delete_case");
  const canManageRecords = can(currentUser.role, "manage_case_records");
  const visibleTabs = TABS.filter((tab) => tab.key !== "payments" || canViewFinance);

  function handleStatusUpdate() {
    if (!selectedStatus) return;
    const prev = caseItem.status;
    updateCase(caseId, { status: selectedStatus as CaseStatus });
    addActivityLog({
      organizationId: caseItem.organizationId,
      caseId,
      actorId: currentUser.id,
      action: "Cập nhật trạng thái",
      entityType: "cases",
      entityId: caseId,
      previousValue: prev,
      newValue: selectedStatus,
    });
    setStatusModalOpen(false);
    setSelectedStatus("");
  }

  function handleDeleteCase() {
    archiveCase(caseId);
    addActivityLog({
      organizationId: caseItem.organizationId,
      caseId,
      actorId: currentUser.id,
      action: "Xóa mềm hồ sơ",
      entityType: "cases",
      entityId: caseId,
      newValue: caseItem.caseCode,
    });
    navigate("cases");
  }

  const submissionStatusColors: Record<SubmissionStatus, string> = {
    "Đã nộp": "bg-cyan-100 text-cyan-700",
    "Cần bổ sung": "bg-yellow-100 text-yellow-700",
    "Có kết quả": "bg-teal-100 text-teal-700",
    "Đã nhận": "bg-green-100 text-green-700",
    "Đã hủy": "bg-red-100 text-red-700",
  };

  const taskStatusColors: Record<TaskStatus, string> = {
    "Chưa làm": "bg-gray-100 text-gray-600",
    "Đang làm": "bg-blue-100 text-blue-700",
    "Hoàn thành": "bg-green-100 text-green-700",
  };

  const paymentTypeColors: Record<PaymentType, string> = {
    Thu: "bg-green-100 text-green-700",
    Chi: "bg-red-100 text-red-700",
  };

  // ── Tab content renderer (shared between mobile and desktop) ──────────────
  function renderTabContent() {
    return (
      <>
        {activeTab === "info" && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <User size={18} className="text-[#1a3a8a]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Người phụ trách</p>
                  <p className="text-sm font-semibold text-gray-800">{assignedProfile?.fullName ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-[#1a3a8a]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Ngày hẹn trả</p>
                  <p className="text-sm font-semibold text-gray-800">{formatDate(caseItem.promisedDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-[#1a3a8a]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Ngày tiếp nhận</p>
                  <p className="text-sm font-semibold text-gray-800">{formatDate(caseItem.receivedDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-[#1a3a8a]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Hạn nội bộ</p>
                  <p className="text-sm font-semibold text-gray-800">{formatDate(caseItem.internalDueDate)}</p>
                </div>
              </div>
            </div>

            {caseProperties.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bất động sản</h3>
                {caseProperties.map((prop) =>
                  prop ? (
                    <div key={prop.id} className="text-sm space-y-1">
                      <p className="font-medium text-gray-800">{prop.address}</p>
                      <p className="text-xs text-gray-500">
                        Tờ {prop.mapSheetNumber} - Thửa {prop.parcelNumber} · {prop.area} m²
                      </p>
                      <p className="text-xs text-gray-500">{prop.landType}</p>
                      <p className="text-xs text-gray-400">Chủ sổ: {prop.certificateOwner}</p>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {canViewFinance && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tài chính</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Phí dịch vụ</span>
                    <span className="font-semibold text-gray-800">{formatVnd(caseItem.serviceFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Đã thu</span>
                    <span className="font-semibold text-green-600">{formatVnd(paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Đã chi cho hồ sơ</span>
                    <span className="font-semibold text-red-600">{formatVnd(spent)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                    <span className="text-gray-500">Còn phải thu</span>
                    <span className={`font-bold ${receivable > 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatVnd(receivable)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(caseItem.description || caseItem.holdReason) && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                {caseItem.description && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-400 mb-1">Mô tả</p>
                    <p className="text-sm text-gray-700">{caseItem.description}</p>
                  </div>
                )}
                {caseItem.holdReason && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Lý do tạm dừng / bổ sung</p>
                    <p className="text-sm text-orange-600">{caseItem.holdReason}</p>
                  </div>
                )}
              </div>
            )}

            {canUpdateProgress && (
              <button
                onClick={() => {
                  setSelectedStatus(caseItem.status);
                  setStatusModalOpen(true);
                }}
                className="w-full bg-[#ea580c] hover:bg-orange-600 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={18} />
                Cập nhật tiến độ
              </button>
            )}
            {canDeleteCase && (
              <button
                onClick={handleDeleteCase}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl py-4 flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={18} />
                Xóa hồ sơ
              </button>
            )}
          </div>
        )}

        {activeTab === "submissions" && (
          <div className="space-y-3">
            {receiptImageSubmissions.length > 0 && (
              <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-[#1a3a8a]">Ảnh biên nhận đã lưu</h3><p className="mt-1 text-xs text-blue-700">Ảnh thuộc các lần nộp bên dưới. Bấm ảnh để xem bản gốc.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1a3a8a]">{receiptImageSubmissions.length} ảnh</span></div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{receiptImageSubmissions.map((submission) => <a key={submission.id} href={submission.receiptImageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-blue-100 bg-white"><img src={submission.receiptImageUrl} alt={`Biên nhận ${submission.submissionCode}`} className="h-32 w-full object-cover bg-gray-50" /><p className="truncate px-2 py-2 font-mono text-xs font-bold text-[#1a3a8a]">{submission.submissionCode}</p></a>)}</div>
              </section>
            )}
            {caseSubmissions.length === 0 ? (
              <EmptyState title="Chưa có lần nộp" message="Nhấn nút bên dưới để thêm lần nộp hồ sơ." />
            ) : (
              caseSubmissions.map((sub) => (
                <div key={sub.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-[#1a3a8a]">{sub.submissionCode}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{sub.procedureType}</p>
                    </div>
                    <div className="flex items-center gap-2"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${submissionStatusColors[sub.status]}`}>{sub.status}</span>{canManageRecords ? <button type="button" onClick={() => { if (window.confirm(`Xóa lần nộp ${sub.submissionCode}?`)) deleteSubmission(sub.id); }} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" aria-label="Xóa lần nộp"><Trash2 size={15} /></button> : null}</div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>Cơ quan: {sub.receivingAgency}</p>
                    <p>Ngày nộp: {formatDate(sub.submittedDate)}</p>
                    <p>Hẹn trả: {formatDate(sub.expectedReturnDate)}</p>
                    {sub.officerNote && <p className="text-orange-600">Ghi chú: {sub.officerNote}</p>}
                  </div>
                  {sub.receiptImageUrl ? <a href={sub.receiptImageUrl} target="_blank" rel="noreferrer" className="mt-3 block"><img src={sub.receiptImageUrl} alt={`Biên nhận ${sub.submissionCode}`} className="max-h-56 w-full rounded-xl border border-gray-100 object-contain bg-gray-50" /></a> : <p className="mt-3 text-xs text-gray-400">Chưa có ảnh biên nhận</p>}
                </div>
              ))
            )}
            {canAddSubmission && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => navigate("scan-receipt", { caseId })}
                  className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 py-4 flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 hover:border-emerald-400 transition-colors"
                >
                  <Camera size={16} /> Quét biên nhận
                </button>
                <button
                  onClick={() => setSubmissionModalOpen(true)}
                  className="rounded-2xl border-2 border-dashed border-gray-200 py-4 flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:border-[#1a3a8a] hover:text-[#1a3a8a] transition-colors"
                >
                  <Plus size={16} /> Thêm lần nộp tay
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-3">
            {originalDocuments.length > 0 ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-amber-950">Bản chính đang giữ</h3>
                    <p className="mt-0.5 text-xs text-amber-800">Theo dõi người giữ và lần bàn giao gần nhất.</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-800">
                    {originalDocuments.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {originalDocuments.map((document) => {
                    const holder = data.profiles.find((profile) => profile.id === document.currentHolderId);
                    const latestTransfer = caseCustodyTransfers
                      .filter((transfer) => transfer.documentId === document.id)
                      .sort((first, second) => second.transferredAt.localeCompare(first.transferredAt))[0];
                    const handedToCustomer = latestTransfer?.transferType === "Bàn giao khách";
                    return (
                      <div key={document.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2.5">
                        <p className="text-sm font-semibold text-gray-800">{document.documentName}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                          <span>{handedToCustomer ? "Trạng thái: Đã bàn giao khách" : `Người giữ: ${holder?.fullName ?? "Chưa xác định"}`}</span>
                          <span>Vị trí: {document.storageLocation ?? "Chưa cập nhật"}</span>
                          <span>Lần giao gần nhất: {latestTransfer ? formatDate(latestTransfer.transferredAt) : "Chưa có"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {caseDocuments.length === 0 ? (
              <EmptyState title="Chưa có tài liệu" message="Thêm tài liệu liên quan đến hồ sơ này." />
            ) : (
              caseDocuments.map((doc) => {
                const holder = data.profiles.find((p) => p.id === doc.currentHolderId);
                const docTransfers = caseCustodyTransfers
                  .filter((ct) => ct.documentId === doc.id)
                  .sort((a, b) => b.transferredAt.localeCompare(a.transferredAt));
                const handedToCustomer = docTransfers[0]?.transferType === "Bàn giao khách";
                return (
                  <div key={doc.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-800 flex-1 pr-2">{doc.documentName}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.confidential && (
                          <span className="flex items-center gap-0.5 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">
                            <Lock size={8} /> Mật
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            doc.originalOrCopy === "Bản chính"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {doc.originalOrCopy}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>SL: {doc.quantity} · {doc.documentType}</p>
                      {handedToCustomer ? <p className="font-semibold text-emerald-700">Đã bàn giao khách: {formatDate(docTransfers[0].transferredAt)}</p> : <p>Người giữ: {holder?.fullName ?? "Chưa cập nhật"}</p>}
                      {doc.storageLocation && <p>Vị trí: {doc.storageLocation}</p>}
                    </div>
                    {docTransfers.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Lịch sử bàn giao</p>
                        {docTransfers.slice(0, 3).map((ct) => {
                          const toUser = data.profiles.find((p) => p.id === ct.toUserId);
                          const fromUser = ct.fromUserId ? data.profiles.find((p) => p.id === ct.fromUserId) : null;
                          const handedToCustomer = ct.transferType === "Bàn giao khách";
                          return (
                            <div key={ct.id} className="flex items-center gap-1.5 text-[11px] text-gray-500 py-0.5">
                              <ArrowRightLeft size={10} className="text-gray-400 shrink-0" />
                              <span className="font-medium text-gray-700">{ct.transferType}</span>
                              <span>→ {handedToCustomer ? "Khách hàng" : toUser?.fullName ?? "—"}</span>
                              {fromUser && <span className="text-gray-400">từ {fromUser.fullName}</span>}
                              <span className="ml-auto text-gray-400">{formatDate(ct.transferredAt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                      {canAddDocument ? <button onClick={() => { setTransferDocId(doc.id); setTransferModalOpen(true); }} className="flex items-center gap-1 text-[#1a3a8a] hover:text-[#ea580c] transition-colors"><ArrowRightLeft size={12} /> Bàn giao</button> : null}
                      {canManageRecords ? <button onClick={() => setEditingDocument(doc)} className="flex items-center gap-1 text-[#1a3a8a] hover:text-[#ea580c] transition-colors"><Pencil size={12} /> Sửa</button> : null}
                      {canManageRecords ? <button onClick={() => { if (window.confirm(`Xóa tài liệu ${doc.documentName} và lịch sử bàn giao liên quan?`)) deleteDocument(doc.id); }} className="flex items-center gap-1 text-rose-600 hover:text-rose-800"><Trash2 size={12} /> Xóa</button> : null}
                    </div>
                  </div>
                );
              })
            )}
            {canAddDocument && (
              <button
                onClick={() => setDocumentModalOpen(true)}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 flex items-center justify-center gap-2 text-sm font-semibold text-gray-400 hover:border-[#1a3a8a] hover:text-[#1a3a8a] transition-colors"
              >
                <Plus size={16} /> Thêm tài liệu
              </button>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-3">
            {caseTasks.length === 0 ? (
              <EmptyState title="Chưa có công việc" message="Thêm công việc cho hồ sơ này." />
            ) : (
              caseTasks.map((task) => (
                <div key={task.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3">
                  <button
                    onClick={() => canCompleteTasks && task.status !== "Hoàn thành" && completeTask(task.id)}
                    className={`mt-0.5 shrink-0 ${canCompleteTasks ? "cursor-pointer" : "cursor-default"}`}
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
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${taskStatusColors[task.status]}`}
                      >
                        {task.status}
                      </span>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Hạn: {formatDate(task.dueDate)} {task.dueTime ?? ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => { if (window.confirm(`Xóa công việc ${task.title}?`)) deleteTask(task.id); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100" aria-label="Xóa công việc"><Trash2 size={15} /> Xóa công việc</button>
                </div>
              ))
            )}
            {canCompleteTasks && (
              <button
                onClick={() => setTaskModalOpen(true)}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 flex items-center justify-center gap-2 text-sm font-semibold text-gray-400 hover:border-[#1a3a8a] hover:text-[#1a3a8a] transition-colors"
              >
                <Plus size={16} /> Thêm công việc
              </button>
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div className="space-y-3">
            {!canViewFinance ? (
              <EmptyState title="Không có quyền xem" message="Chức năng này yêu cầu quyền kế toán." />
            ) : (
              <>
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tóm tắt</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Phí dịch vụ</span>
                    <span className="font-semibold">{formatVnd(caseItem.serviceFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Đã thu</span>
                    <span className="font-semibold text-green-600">{formatVnd(paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-gray-500">Còn lại</span>
                    <span className={`font-bold ${receivable > 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatVnd(receivable)}
                    </span>
                  </div>
                </div>

                {casePayments.length === 0 ? (
                  <EmptyState title="Chưa có giao dịch" message="Ghi nhận thu chi cho hồ sơ này." />
                ) : (
                  casePayments.map((payment) => (
                    <div key={payment.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-800">{payment.category}</p>
                        <div className="flex items-center gap-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${paymentTypeColors[payment.paymentType]}`}>{payment.paymentType}</span>{canEditFinance ? <button type="button" onClick={() => { if (window.confirm(`Xóa giao dịch ${payment.category}?`)) deletePayment(payment.id); }} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" aria-label="Xóa giao dịch"><Trash2 size={15} /></button> : null}</div>
                      </div>
                      <p className="text-base font-bold text-[#1a3a8a]">{formatVnd(payment.amount)}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(payment.paymentDate)} · {payment.paymentMethod}
                      </p>
                    </div>
                  ))
                )}

                <div className={`grid gap-2 ${canEditFinance ? "sm:grid-cols-2" : ""}`}>{canEditFinance ? <button onClick={() => setPaymentModalOpen(true)} className="rounded-2xl border-2 border-dashed border-gray-200 py-4 flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:border-[#1a3a8a] hover:text-[#1a3a8a] transition-colors"><Plus size={16} /> Ghi nhận thu chi</button> : null}<button onClick={() => navigate("finance", { caseId })} className="rounded-2xl border border-[rgba(198,152,53,0.25)] bg-[rgba(255,245,220,0.5)] py-4 text-sm font-bold text-[var(--gold-700)]">Xem Thu chi tổng</button></div>
              </>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="relative">
            {caseActivityLogs.length === 0 ? (
              <EmptyState title="Chưa có lịch sử" message="Các thay đổi sẽ được ghi lại ở đây." />
            ) : (
              <div className="space-y-0">
                {[...caseActivityLogs].reverse().map((log, idx) => {
                  const actor = data.profiles.find((p) => p.id === log.actorId);
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-[#1a3a8a] mt-1 shrink-0" />
                        {idx < caseActivityLogs.length - 1 && (
                          <div className="w-0.5 bg-gray-200 flex-1 my-1" />
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <p className="text-sm font-semibold text-gray-800">{log.action}</p>
                        {log.previousValue && log.newValue && (
                          <p className="text-xs text-gray-500">
                            {log.previousValue} → {log.newValue}
                          </p>
                        )}
                        {!log.previousValue && log.newValue && (
                          <p className="text-xs text-gray-500">{log.newValue}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {actor?.fullName ?? log.actorId} ·{" "}
                          {new Date(log.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* ── Mobile layout ── */}
      <div className="md:hidden flex flex-col h-full">
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex gap-3 items-start mb-3">
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <FileCheck size={24} className="text-[#1a3a8a]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-extrabold text-gray-800">{customer?.fullName ?? "—"}</h2>
                <div className="flex items-center gap-1 text-sm text-[#1a3a8a] font-medium mt-0.5">
                  <Building2 size={13} />
                  <span>{caseItem.serviceType}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{caseItem.caseCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400" />
              <StatusBadge status={caseItem.status} />
              <PriorityBadge priority={caseItem.priority} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-4 scrollbar-none">
          <div className="flex gap-0 border-b border-gray-200 min-w-max">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[#ea580c] text-[#ea580c]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
          {renderTabContent()}
        </div>
      </div>

      {/* ── Desktop layout: left panel + right tabs ── */}
      <div className="hidden md:flex gap-6 p-6 h-full overflow-hidden">
        {/* Left panel: sticky case info */}
        <div className="w-80 shrink-0 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex gap-3 items-start mb-4">
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <FileCheck size={24} className="text-[#1a3a8a]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-extrabold text-gray-800">{customer?.fullName ?? "—"}</h2>
                <div className="flex items-center gap-1 text-sm text-[#1a3a8a] font-medium mt-0.5">
                  <Building2 size={13} />
                  <span>{caseItem.serviceType}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{caseItem.caseCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={caseItem.status} />
              <PriorityBadge priority={caseItem.priority} />
            </div>
          </div>

          {/* Property info */}
          {caseProperties.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bất động sản</h3>
              {caseProperties.map((prop) =>
                prop ? (
                  <div key={prop.id} className="text-sm space-y-1">
                    <p className="font-medium text-gray-800">{prop.address}</p>
                    <p className="text-xs text-gray-500">
                      Tờ {prop.mapSheetNumber} - Thửa {prop.parcelNumber} · {prop.area} m²
                    </p>
                    <p className="text-xs text-gray-500">{prop.landType}</p>
                    <p className="text-xs text-gray-400">Chủ sổ: {prop.certificateOwner}</p>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Financial summary */}
          {canViewFinance && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tài chính</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Phí dịch vụ</span>
                  <span className="font-semibold text-gray-800">{formatVnd(caseItem.serviceFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Đã thu</span>
                  <span className="font-semibold text-green-600">{formatVnd(paid)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-500">Còn phải thu</span>
                  <span className={`font-bold ${receivable > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatVnd(receivable)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {canUpdateProgress && (
            <button
              onClick={() => {
                setSelectedStatus(caseItem.status);
                setStatusModalOpen(true);
              }}
              className="w-full bg-[#ea580c] hover:bg-orange-600 text-white font-bold rounded-2xl py-3 flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw size={18} />
              Cập nhật tiến độ
            </button>
          )}
          {canDeleteCase && (
            <button
              onClick={handleDeleteCase}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl py-3 flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 size={18} />
              Xóa hồ sơ
            </button>
          )}
        </div>

        {/* Right panel: tabs + content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex gap-0 border-b border-gray-200 shrink-0">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[#ea580c] text-[#ea580c]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* ── Modals (shared) ── */}
      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Cập nhật tiến độ">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Chọn trạng thái mới:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {CASE_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${
                  selectedStatus === status
                    ? "border-[#ea580c] bg-orange-50 text-[#ea580c]"
                    : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <button
            onClick={handleStatusUpdate}
            disabled={!selectedStatus}
            className="w-full bg-[#ea580c] hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition-colors"
          >
            Xác nhận
          </button>
        </div>
      </Modal>

      <SubmissionModal
        open={submissionModalOpen}
        onClose={() => setSubmissionModalOpen(false)}
        currentUserId={currentUser.id}
        onSubmit={(values) => {
          addSubmission({
            ...values,
            caseId,
            status: "Đã nộp",
          });
          setSubmissionModalOpen(false);
        }}
      />

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        profiles={data.profiles}
        currentUserId={currentUser.id}
        onSubmit={(values) => {
          addTask({ ...values, caseId, status: "Chưa làm" });
          setTaskModalOpen(false);
        }}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        serviceFee={caseItem.serviceFee}
        onSubmit={(values) => {
          addPayment({ ...values, caseId, createdBy: currentUser.id });
          setPaymentModalOpen(false);
        }}
      />

      <DocumentModal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        profiles={data.profiles}
        currentUserId={currentUser.id}
        onSubmit={(values) => {
          addDocument({ ...values, caseId });
          setDocumentModalOpen(false);
        }}
      />

      <EditDocumentModal
        key={editingDocument?.id ?? "no-document"}
        document={editingDocument}
        onClose={() => setEditingDocument(null)}
        onSubmit={(updates) => {
          if (!editingDocument) return;
          updateDocument(editingDocument.id, updates);
          addActivityLog({
            organizationId: caseItem.organizationId,
            caseId,
            actorId: currentUser.id,
            action: `Cập nhật tài liệu: ${updates.documentName}`,
            entityType: "documents",
            entityId: editingDocument.id,
          });
          setEditingDocument(null);
        }}
      />

      <CustodyTransferModal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        profiles={data.profiles}
        currentUserId={currentUser.id}
        customerName={customer?.fullName ?? "Khách hàng"}
        onSubmit={(values) => {
          addCustodyTransfer({
            documentId: transferDocId,
            ...values,
            createdBy: currentUser.id,
          });
          addActivityLog({
            organizationId: caseItem.organizationId,
            caseId,
            actorId: currentUser.id,
            action: `Bàn giao tài liệu: ${values.transferType}`,
            entityType: "custodyTransfers",
            entityId: transferDocId,
          });
          setTransferModalOpen(false);
        }}
      />
    </>
  );
}

function SubmissionModal({
  open,
  onClose,
  currentUserId,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onSubmit: (values: {
    submissionCode: string;
    procedureType: string;
    receivingAgency: string;
    submittedDate: string;
    expectedReturnDate: string;
    submittedBy: string;
    applicantName: string;
  }) => void;
}) {
  const today = todayIso();
  const [form, setForm] = useState({
    submissionCode: "",
    procedureType: "",
    receivingAgency: "",
    submittedDate: today,
    expectedReturnDate: "",
    applicantName: "",
  });

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Modal open={open} onClose={onClose} title="Thêm lần nộp">
      <div className="space-y-3">
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Mã biên nhận"
          value={form.submissionCode}
          onChange={(e) => set("submissionCode", e.target.value)}
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Loại thủ tục"
          value={form.procedureType}
          onChange={(e) => set("procedureType", e.target.value)}
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Cơ quan tiếp nhận"
          value={form.receivingAgency}
          onChange={(e) => set("receivingAgency", e.target.value)}
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Tên người nộp"
          value={form.applicantName}
          onChange={(e) => set("applicantName", e.target.value)}
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Ngày nộp</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={form.submittedDate}
              onChange={(e) => set("submittedDate", e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Ngày hẹn trả</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={form.expectedReturnDate}
              onChange={(e) => set("expectedReturnDate", e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => {
            if (!form.submissionCode || !form.procedureType || !form.receivingAgency) return;
            onSubmit({ ...form, submittedBy: currentUserId });
          }}
          className="w-full bg-[#ea580c] text-white font-bold rounded-xl py-3"
        >
          Lưu
        </button>
      </div>
    </Modal>
  );
}

function TaskModal({
  open,
  onClose,
  profiles,
  currentUserId,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  profiles: Array<{ id: string; fullName: string; role: string }>;
  currentUserId: string;
  onSubmit: (values: {
    title: string;
    assignedTo: string;
    dueDate: string;
    dueTime?: string;
    priority: Priority;
    description?: string;
  }) => void;
}) {
  const today = todayIso();
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [dueDate, setDueDate] = useState(today);
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<Priority>("Trung bình");

  return (
    <Modal open={open} onClose={onClose} title="Thêm công việc">
      <div className="space-y-3">
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Tiêu đề công việc"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
        <select
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          {(["Thấp", "Trung bình", "Cao", "Khẩn"] as Priority[]).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Ngày hạn</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Giờ (tùy chọn)</label>
            <input
              type="time"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => {
            if (!title.trim()) return;
            onSubmit({ title, assignedTo, dueDate, dueTime: dueTime || undefined, priority });
          }}
          className="w-full bg-[#ea580c] text-white font-bold rounded-xl py-3"
        >
          Lưu
        </button>
      </div>
    </Modal>
  );
}

function PaymentModal({
  open,
  onClose,
  serviceFee,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  serviceFee: number;
  onSubmit: (values: {
    paymentType: PaymentType;
    category: string;
    amount: number;
    paymentDate: string;
    paymentMethod: "Tiền mặt" | "Chuyển khoản" | "Khác";
    note?: string;
  }) => void;
}) {
  const today = todayIso();
  const [paymentType, setPaymentType] = useState<PaymentType>("Thu");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<"Tiền mặt" | "Chuyển khoản" | "Khác">("Tiền mặt");

  return (
    <Modal open={open} onClose={onClose} title="Ghi nhận thu chi">
      <div className="space-y-3">
        <div className="flex gap-2">
          {(["Thu", "Chi"] as PaymentType[]).map((t) => (
            <button
              key={t}
              onClick={() => setPaymentType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                paymentType === t ? "bg-[#ea580c] text-white border-[#ea580c]" : "border-gray-200 text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {paymentType === "Thu" ? <button type="button" onClick={() => { setCategory("Phí dịch vụ"); setAmount(String(serviceFee)); }} className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800"><span>Điền phí dịch vụ hồ sơ</span><span>{formatVnd(serviceFee)}</span></button> : null}
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Hạng mục"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Số tiền (VND)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Ngày</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Hình thức</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "Tiền mặt" | "Chuyển khoản" | "Khác")}
            >
              <option>Tiền mặt</option>
              <option>Chuyển khoản</option>
              <option>Khác</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => {
            const amt = Number(amount);
            if (!category || !amt) return;
            onSubmit({ paymentType, category, amount: amt, paymentDate, paymentMethod });
          }}
          className="w-full bg-[#ea580c] text-white font-bold rounded-xl py-3"
        >
          Lưu
        </button>
      </div>
    </Modal>
  );
}

function DocumentModal({
  open,
  onClose,
  profiles,
  currentUserId,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  profiles: Array<{ id: string; fullName: string }>;
  currentUserId: string;
  onSubmit: (values: {
    documentName: string;
    documentType: string;
    originalOrCopy: "Bản chính" | "Bản sao" | "Bản scan";
    quantity: number;
    confidential: boolean;
    currentHolderId?: string;
    storageLocation?: string;
    receivedDate?: string;
  }) => void;
}) {
  const today = todayIso();
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [originalOrCopy, setOriginalOrCopy] = useState<"Bản chính" | "Bản sao" | "Bản scan">("Bản chính");
  const [quantity, setQuantity] = useState("1");
  const [confidential, setConfidential] = useState(false);
  const [currentHolderId, setCurrentHolderId] = useState(currentUserId);
  const [storageLocation, setStorageLocation] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Thêm tài liệu">
      <div className="space-y-3">
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Tên tài liệu"
          value={documentName}
          onChange={(e) => setDocumentName(e.target.value)}
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Loại tài liệu"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
        />
        <select
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          value={originalOrCopy}
          onChange={(e) => setOriginalOrCopy(e.target.value as "Bản chính" | "Bản sao" | "Bản scan")}
        >
          <option>Bản chính</option>
          <option>Bản sao</option>
          <option>Bản scan</option>
        </select>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Số lượng"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <select
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
          value={currentHolderId}
          onChange={(e) => setCurrentHolderId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Vị trí lưu trữ (tùy chọn)"
          value={storageLocation}
          onChange={(e) => setStorageLocation(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={confidential}
            onChange={(e) => setConfidential(e.target.checked)}
            className="rounded"
          />
          Tài liệu mật
        </label>
        <button
          onClick={() => {
            if (!documentName || !documentType) return;
            onSubmit({
              documentName,
              documentType,
              originalOrCopy,
              quantity: Number(quantity) || 1,
              confidential,
              currentHolderId: currentHolderId || undefined,
              storageLocation: storageLocation || undefined,
              receivedDate: today,
            });
          }}
          className="w-full bg-[#ea580c] text-white font-bold rounded-xl py-3"
        >
          Lưu
        </button>
      </div>
    </Modal>
  );
}

function EditDocumentModal({
  document,
  onClose,
  onSubmit,
}: {
  document: DocumentRecord | null;
  onClose: () => void;
  onSubmit: (updates: Pick<DocumentRecord, "documentName" | "documentType" | "originalOrCopy" | "quantity" | "confidential" | "storageLocation">) => void;
}) {
  const [documentName, setDocumentName] = useState(document?.documentName ?? "");
  const [documentType, setDocumentType] = useState(document?.documentType ?? "");
  const [originalOrCopy, setOriginalOrCopy] = useState<DocumentRecord["originalOrCopy"]>(document?.originalOrCopy ?? "Bản chính");
  const [quantity, setQuantity] = useState(String(document?.quantity ?? 1));
  const [storageLocation, setStorageLocation] = useState(document?.storageLocation ?? "");
  const [confidential, setConfidential] = useState(document?.confidential ?? false);

  return (
    <Modal open={Boolean(document)} onClose={onClose} title="Sửa tài liệu">
      <div className="space-y-3">
        <input
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          placeholder="Tên tài liệu"
          value={documentName}
          onChange={(event) => setDocumentName(event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          placeholder="Loại tài liệu"
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
            value={originalOrCopy}
            onChange={(event) => setOriginalOrCopy(event.target.value as DocumentRecord["originalOrCopy"])}
          >
            <option>Bản chính</option>
            <option>Bản sao</option>
            <option>Bản scan</option>
          </select>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            placeholder="Số lượng"
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <input
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          placeholder="Vị trí lưu trữ (tùy chọn)"
          value={storageLocation}
          onChange={(event) => setStorageLocation(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={confidential}
            onChange={(event) => setConfidential(event.target.checked)}
            className="rounded"
          />
          Tài liệu mật
        </label>
        <button
          type="button"
          onClick={() => {
            const normalizedName = documentName.trim();
            const normalizedType = documentType.trim();
            if (!normalizedName || !normalizedType) return;
            onSubmit({
              documentName: normalizedName,
              documentType: normalizedType,
              originalOrCopy,
              quantity: Math.max(1, Number(quantity) || 1),
              confidential,
              storageLocation: storageLocation.trim(),
            });
          }}
          className="w-full rounded-xl bg-[#ea580c] py-3 font-bold text-white"
        >
          Lưu thay đổi
        </button>
      </div>
    </Modal>
  );
}

function CustodyTransferModal({
  open,
  onClose,
  profiles,
  currentUserId,
  customerName,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  profiles: Array<{ id: string; fullName: string }>;
  currentUserId: string;
  customerName: string;
  onSubmit: (values: {
    transferType: CustodyTransfer["transferType"];
    toUserId: string;
    fromUserId?: string;
    transferredAt: string;
    note?: string;
  }) => void;
}) {
  const today = todayIso();
  const [transferType, setTransferType] = useState<CustodyTransfer["transferType"]>("Nhận từ khách");
  const [toUserId, setToUserId] = useState(currentUserId);
  const [fromUserId, setFromUserId] = useState("");
  const [transferredAt, setTransferredAt] = useState(today);
  const [note, setNote] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Phiếu bàn giao tài liệu">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Loại bàn giao</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            value={transferType}
            onChange={(e) => setTransferType(e.target.value as CustodyTransfer["transferType"])}
          >
            {TRANSFER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Người giao (tùy chọn)</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value)}
          >
            <option value="">— Không chọn —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{transferType === "Bàn giao khách" ? "Nhân viên xác nhận bàn giao" : "Người nhận"}</label>
          {transferType === "Bàn giao khách" ? <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Tài liệu sẽ được đánh dấu đã bàn giao cho: {customerName}</p> : null}
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Ngày bàn giao</label>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={transferredAt}
            onChange={(e) => setTransferredAt(e.target.value)}
          />
        </div>
        <textarea
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="Ghi chú (tùy chọn)"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          onClick={() => {
            if (!toUserId) return;
            onSubmit({
              transferType,
              toUserId,
              fromUserId: fromUserId || undefined,
              transferredAt,
              note: note || undefined,
            });
          }}
          className="w-full bg-[#ea580c] text-white font-bold rounded-xl py-3"
        >
          Xác nhận bàn giao
        </button>
      </div>
    </Modal>
  );
}
