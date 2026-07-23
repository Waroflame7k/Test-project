"use client";

import { useMemo, useState } from "react";
import { Archive, FileText, Search, UserRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { formatDate } from "@/lib/date";
import { can } from "@/lib/permissions";

type DocumentFilter = "all" | "original" | "copy";
type CustodyFilter = "all" | "internal" | "customer" | "missing";

function isHandedToCustomer(document: { returnedDate?: string }, latestTransfer?: { transferType: string }): boolean {
  return latestTransfer?.transferType === "Bàn giao khách" || Boolean(document.returnedDate && !latestTransfer);
}

export function DocumentsScreen() {
  const { data, navigate } = useApp();
  const currentUser = useCurrentUser();
  const [filter, setFilter] = useState<DocumentFilter>("original");
  const [custodyFilter, setCustodyFilter] = useState<CustodyFilter>("all");
  const [query, setQuery] = useState("");
  const canManageDocuments = can(currentUser.role, "view_all_cases") || can(currentUser.role, "add_documents");
  const allowedCaseIds = useMemo(() => {
    if (can(currentUser.role, "view_all_cases")) return new Set(data.cases.filter((caseItem) => !caseItem.archivedAt).map((caseItem) => caseItem.id));
    return new Set(data.cases.filter((caseItem) => caseItem.assignedTo === currentUser.id && !caseItem.archivedAt).map((caseItem) => caseItem.id));
  }, [currentUser.id, currentUser.role, data.cases]);
  const latestTransferByDocumentId = useMemo(() => {
    const latest = new Map<string, (typeof data.custodyTransfers)[number]>();
    data.custodyTransfers.forEach((transfer) => {
      const current = latest.get(transfer.documentId);
      if (!current || transfer.transferredAt > current.transferredAt) latest.set(transfer.documentId, transfer);
    });
    return latest;
  }, [data]);
  const originalOverview = useMemo(() => {
    return data.documents
      .filter((document) => allowedCaseIds.has(document.caseId) && document.originalOrCopy === "Bản chính")
      .reduce(
        (summary, document) => {
          const latestTransfer = latestTransferByDocumentId.get(document.id);
          if (isHandedToCustomer(document, latestTransfer)) summary.handedToCustomer += 1;
          else if (document.currentHolderId) summary.internal += 1;
          else summary.missing += 1;
          return summary;
        },
        { internal: 0, handedToCustomer: 0, missing: 0 }
      );
  }, [allowedCaseIds, data.documents, latestTransferByDocumentId]);
  const documents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.documents
      .filter((document) => allowedCaseIds.has(document.caseId))
      .filter((document) => filter === "all" || (filter === "original" ? document.originalOrCopy === "Bản chính" : document.originalOrCopy !== "Bản chính"))
      .filter((document) => {
        const latestTransfer = latestTransferByDocumentId.get(document.id);
        if (custodyFilter === "customer") return isHandedToCustomer(document, latestTransfer);
        if (custodyFilter === "internal") return !isHandedToCustomer(document, latestTransfer) && Boolean(document.currentHolderId);
        if (custodyFilter === "missing") return !isHandedToCustomer(document, latestTransfer) && !document.currentHolderId;
        return true;
      })
      .filter((document) => {
        if (!normalizedQuery) return true;
        const caseItem = data.cases.find((item) => item.id === document.caseId);
        const customer = data.customers.find((item) => item.id === caseItem?.customerId);
        const holder = data.profiles.find((item) => item.id === document.currentHolderId);
        return [document.documentName, document.documentType, caseItem?.caseCode, customer?.fullName, holder?.fullName, document.storageLocation]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((first, second) => {
        const originalRank = Number(second.originalOrCopy === "Bản chính") - Number(first.originalOrCopy === "Bản chính");
        return originalRank || second.createdAt.localeCompare(first.createdAt);
      });
  }, [allowedCaseIds, custodyFilter, data.cases, data.customers, data.documents, data.profiles, filter, latestTransferByDocumentId, query]);

  if (!canManageDocuments) {
    return <EmptyState title="Không có quyền quản lý tài liệu" message="Chức năng này dành cho quản trị, quản lý và nhân viên pháp lý." />;
  }

  return (
    <div className="space-y-4 pb-6 md:space-y-6">
      <section className="luxe-panel-strong rounded-[1.5rem] p-4 md:p-5">
        <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(255,245,220,0.95)] text-[var(--gold-700)]"><Archive size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Kho tài liệu</p><h2 className="mt-1 text-xl font-black text-[var(--text-main)]">Quản lý tài liệu</h2><p className="mt-1 text-sm text-[var(--text-soft)]">Theo dõi bản chính đang giữ, vị trí lưu và lịch sử bàn giao theo hồ sơ.</p></div></div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]"><div className="flex items-center gap-2 rounded-xl border border-[rgba(198,152,53,0.14)] bg-white px-3 py-2.5"><Search size={16} className="text-[var(--text-faint)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tài liệu, khách hàng, người giữ..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]" /></div><div className="flex gap-2 overflow-x-auto">{([ ["original", "Bản chính"], ["all", "Tất cả"], ["copy", "Bản sao / scan"] ] as Array<[DocumentFilter, string]>).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${filter === value ? "luxe-button-primary" : "luxe-button-secondary"}`}>{label}</button>)}</div></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{([ ["all", "Tất cả vị trí"], ["internal", "Đang nội bộ"], ["customer", "Đã giao khách"], ["missing", "Chưa rõ người giữ"] ] as Array<[CustodyFilter, string]>).map(([value, label]) => <button key={value} onClick={() => setCustodyFilter(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${custodyFilter === value ? "luxe-button-primary" : "luxe-button-secondary"}`}>{label}</button>)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><DocumentStat label="Đang nội bộ" value={originalOverview.internal} tone="text-blue-700" /><DocumentStat label="Đã giao khách" value={originalOverview.handedToCustomer} tone="text-emerald-700" /><DocumentStat label="Chưa rõ" value={originalOverview.missing} tone="text-rose-700" /></div>
      </section>

      <section className="luxe-panel overflow-hidden rounded-[1.5rem]">
        <div className="border-b luxe-divider px-4 py-3 md:px-5"><p className="text-sm font-bold text-[var(--text-main)]">{documents.length} tài liệu hiển thị</p></div>
        {documents.length === 0 ? <div className="p-4"><EmptyState title="Chưa có tài liệu phù hợp" message="Thử đổi bộ lọc hoặc thêm tài liệu trong chi tiết hồ sơ." /></div> : <><div className="divide-y divide-[rgba(198,152,53,0.1)] md:hidden">{documents.map((document) => <DocumentRow key={document.id} document={document} data={data} onOpen={() => navigate("case-detail", { caseId: document.caseId })} compact />)}</div><table className="hidden w-full text-sm md:table"><thead className="bg-[rgba(251,246,236,0.7)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]"><tr><th className="px-5 py-3">Tài liệu</th><th className="px-5 py-3">Hồ sơ</th><th className="px-5 py-3">Người đang giữ</th><th className="px-5 py-3">Vị trí / lần giao gần nhất</th></tr></thead><tbody className="divide-y divide-[rgba(198,152,53,0.1)]">{documents.map((document) => <DocumentRow key={document.id} document={document} data={data} onOpen={() => navigate("case-detail", { caseId: document.caseId })} />)}</tbody></table></>}
      </section>
    </div>
  );
}

function DocumentStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl border border-[rgba(198,152,53,0.12)] bg-white px-2 py-2"><p className="text-[10px] font-semibold text-[var(--text-soft)]">{label}</p><p className={`mt-1 text-lg font-black ${tone}`}>{value}</p></div>;
}

function DocumentRow({ document, data, onOpen, compact = false }: { document: { id: string; caseId: string; documentName: string; documentType: string; originalOrCopy: "Bản chính" | "Bản sao" | "Bản scan"; currentHolderId?: string; storageLocation?: string; returnedDate?: string }; data: ReturnType<typeof useApp>["data"]; onOpen: () => void; compact?: boolean }) {
  const caseItem = data.cases.find((item) => item.id === document.caseId);
  const customer = data.customers.find((item) => item.id === caseItem?.customerId);
  const holder = data.profiles.find((item) => item.id === document.currentHolderId);
  const latestTransfer = data.custodyTransfers.filter((transfer) => transfer.documentId === document.id).sort((first, second) => second.transferredAt.localeCompare(first.transferredAt))[0];
  const original = document.originalOrCopy === "Bản chính";
  const handedToCustomer = isHandedToCustomer(document, latestTransfer);
  if (compact) return <button onClick={onOpen} className="w-full p-4 text-left"><div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${original ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}><FileText size={18} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-bold text-[var(--text-main)]">{document.documentName}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${original ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{document.originalOrCopy}</span></div><p className="mt-1 truncate text-xs text-[var(--text-soft)]">{caseItem?.caseCode} · {customer?.fullName ?? "Chưa xác định"}</p><p className={`mt-2 text-xs font-semibold ${handedToCustomer ? "text-emerald-700" : "text-[var(--text-main)]"}`}>{handedToCustomer ? "Đã bàn giao khách" : `Người giữ: ${holder?.fullName ?? "Chưa cập nhật"}`}</p></div></div></button>;
  return <tr onClick={onOpen} className="cursor-pointer transition hover:bg-[rgba(255,249,240,0.5)]"><td className="px-5 py-3"><p className="font-bold text-[var(--text-main)]">{document.documentName}</p><p className="mt-1 text-xs text-[var(--text-soft)]">{document.documentType} · <span className={original ? "font-bold text-amber-700" : ""}>{document.originalOrCopy}</span></p></td><td className="px-5 py-3"><p className="font-semibold text-[var(--text-main)]">{caseItem?.caseCode ?? "Không có mã"}</p><p className="mt-1 text-xs text-[var(--text-soft)]">{customer?.fullName ?? "Chưa xác định"}</p></td><td className="px-5 py-3"><p className={`inline-flex items-center gap-1.5 font-semibold ${handedToCustomer ? "text-emerald-700" : "text-[var(--text-main)]"}`}>{handedToCustomer ? "Đã bàn giao khách" : <><UserRound size={14} className="text-[var(--gold-700)]" />{holder?.fullName ?? "Chưa cập nhật"}</>}</p></td><td className="px-5 py-3 text-xs text-[var(--text-soft)]"><p>{document.storageLocation ?? "Chưa cập nhật vị trí"}</p><p className="mt-1">Giao gần nhất: {latestTransfer ? formatDate(latestTransfer.transferredAt) : "Chưa có"}</p></td></tr>;
}
