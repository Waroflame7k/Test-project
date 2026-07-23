"use client";

import { useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  User,
} from "lucide-react";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import type { OCRResult } from "@/services/ocr";
import { formatDate, todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { Case, Priority } from "@/types/domain";

const WIZARD_STEPS = [5, 6, 7] as const;
const SUBMITTED_STATUS = "Đã nộp" as const;
const DEFAULT_PRIORITY = "Trung bình" as Priority;

type EntryMode = "manual" | "ocr";

interface ReceiptFormState {
  submissionCode: string;
  procedureType: string;
  receivingAgency: string;
  submittedDate: string;
  expectedReturnDate: string;
  applicantName: string;
  submittedBy: string;
  assignedTo: string;
  priority: Priority;
  note: string;
}

const initialFormState = (submittedBy: string): ReceiptFormState => ({
  submissionCode: "",
  procedureType: "",
  receivingAgency: "",
  submittedDate: todayIso(),
  expectedReturnDate: "",
  applicantName: "",
  submittedBy,
  assignedTo: "",
  priority: DEFAULT_PRIORITY,
  note: "",
});

export function ScanReceiptScreen() {
  const { data, navigate, screenParams, updateCase, addSubmission, addActivityLog } = useApp();
  const currentUser = useCurrentUser();
  const linkedCaseId = typeof screenParams.caseId === "string" ? screenParams.caseId : "";

  const [stepIndex, setStepIndex] = useState(0);
  const [entryMode, setEntryMode] = useState<EntryMode>("ocr");
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState(linkedCaseId);
  const [search, setSearch] = useState("");
  const [receiptImageUrl, setReceiptImageUrl] = useState("");
  const [receiptUploadError, setReceiptUploadError] = useState("");
  const [ocrError, setOcrError] = useState("");
  const [ocrBillingUrl, setOcrBillingUrl] = useState("");
  const [ocrMode, setOcrMode] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState<ReceiptFormState>(() => initialFormState(currentUser.fullName));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assignableProfiles = useMemo(() => {
    return data.profiles.filter(
      (profile) => profile.active && (profile.role === "legal_staff" || profile.role === "manager" || profile.role === "admin")
    );
  }, [data.profiles]);

  const availableCases = useMemo(() => {
    return data.cases.filter((caseItem) => !caseItem.archivedAt);
  }, [data.cases]);

  const suggestedCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return availableCases
      .map((caseItem) => {
        const customer = data.customers.find((item) => item.id === caseItem.customerId);
        const haystack = [caseItem.caseCode, caseItem.serviceType, customer?.fullName ?? "", customer?.phone ?? ""]
          .join(" ")
          .toLowerCase();

        if (query && !haystack.includes(query)) return null;

        let score = 0;
        if (ocrResult && customer) {
          const customerName = customer.fullName.toLowerCase();
          const applicantName = ocrResult.applicantName.toLowerCase();
          const procedureType = ocrResult.procedureType.toLowerCase();

          if (customerName === applicantName) score += 4;
          else if (customerName.includes(applicantName) || applicantName.includes(customerName)) score += 2;

          if (caseItem.serviceType.toLowerCase() === procedureType) score += 3;
          else if (procedureType.includes(caseItem.serviceType.toLowerCase())) score += 1;
        }

        return { caseItem, customer, score };
      })
      .filter(Boolean)
      .sort((first, second) => {
        if (!first || !second) return 0;
        if (second.score !== first.score) return second.score - first.score;
        return second.caseItem.updatedAt.localeCompare(first.caseItem.updatedAt);
      }) as Array<{
      caseItem: Case;
      customer: (typeof data.customers)[number] | undefined;
      score: number;
    }>;
  }, [availableCases, data, ocrResult, search]);

  const suggestedCaseId =
    !selectedCaseId && ocrResult && suggestedCases[0]?.score > 0 ? suggestedCases[0].caseItem.id : "";
  const activeCaseId = linkedCaseId || selectedCaseId || suggestedCaseId;
  const activeAssigneeId = form.assignedTo || assignableProfiles[0]?.id || "";
  const selectedCase = availableCases.find((caseItem) => caseItem.id === activeCaseId) ?? null;
  const selectedCustomer = selectedCase
    ? data.customers.find((customer) => customer.id === selectedCase.customerId) ?? null
    : null;

  function setFormField<K extends keyof ReceiptFormState>(key: K, value: ReceiptFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setReceiptUploadError("");
    setOcrError("");
    setOcrBillingUrl("");
    setOcrMode("");
    setSubmitError("");
    setOcrResult(null);
    setForm((previous) => ({
      ...previous,
      submissionCode: "",
      procedureType: "",
      receivingAgency: "",
      submittedDate: todayIso(),
      expectedReturnDate: "",
      applicantName: "",
    }));
    try {
      const ocrForm = new FormData();
      ocrForm.set("file", file);
      const ocrResponse = await fetch("/api/ocr/receipt", { method: "POST", body: ocrForm });
      if (!ocrResponse.ok) {
        const ocr = (await ocrResponse.json().catch(() => ({}))) as { error?: string; billingUrl?: string };
        setOcrError(ocr.error ?? "Không thể đọc biên nhận này.");
        setOcrBillingUrl(ocr.billingUrl ?? "");
        return;
      }
      const { result, mode } = (await ocrResponse.json()) as { result: OCRResult; mode?: string };
      setOcrResult(result);
      setOcrMode(mode ?? "");
      if (mode !== "mock") {
        const uploadForm = new FormData();
        uploadForm.set("file", file);
        const uploadResponse = await fetch("/api/receipts/upload", { method: "POST", body: uploadForm });
        if (uploadResponse.ok) {
          const upload = (await uploadResponse.json()) as { url: string };
          setReceiptImageUrl(upload.url);
        } else {
          const upload = (await uploadResponse.json().catch(() => ({}))) as { error?: string };
          setReceiptImageUrl("");
          setReceiptUploadError(upload.error ?? "Không thể lưu ảnh biên nhận.");
        }
      }
      setForm((previous) => ({
        ...previous,
        submissionCode: result.submissionCode,
        procedureType: result.procedureType,
        receivingAgency: result.receivingAgency,
        submittedDate: result.submittedDate,
        expectedReturnDate: result.expectedReturnDate,
        applicantName: result.applicantName,
        submittedBy: result.submittedBy || previous.submittedBy,
      }));
      setEntryMode("ocr");
      if (!linkedCaseId) setSelectedCaseId("");
      setStepIndex(0);
    } finally {
      setIsProcessing(false);
    }
  }

  function resetOcr() {
    setOcrResult(null);
    setReceiptImageUrl("");
    setReceiptUploadError("");
    setOcrError("");
    setOcrBillingUrl("");
    setOcrMode("");
    setSubmitError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm((prev) => ({
      ...prev,
      submissionCode: "",
      procedureType: "",
      receivingAgency: "",
      submittedDate: todayIso(),
      expectedReturnDate: "",
      applicantName: "",
    }));
  }

  function canProceed(): boolean {
    if (stepIndex === 0) {
      return Boolean(activeCaseId);
    }

    if (stepIndex === 1) {
      return Boolean(
        form.submissionCode.trim() &&
          form.procedureType.trim() &&
          form.receivingAgency.trim() &&
          form.submittedDate &&
          form.expectedReturnDate &&
          form.applicantName.trim() &&
          activeAssigneeId
      );
    }

    return true;
  }

  function handleSubmit() {
    if (!selectedCase) return;
    const submissionCode = form.submissionCode.trim();
    const duplicate = data.submissions.some(
      (submission) => submission.caseId === selectedCase.id && submission.submissionCode.trim().toLowerCase() === submissionCode.toLowerCase()
    );
    if (duplicate) {
      setSubmitError(`Mã biên nhận ${submissionCode} đã có trong hồ sơ này. Hãy quét ảnh mới hoặc sửa mã trước khi lưu.`);
      return;
    }

    addSubmission({
      caseId: selectedCase.id,
      submissionCode,
      procedureType: form.procedureType.trim(),
      receivingAgency: form.receivingAgency.trim(),
      submittedDate: form.submittedDate,
      expectedReturnDate: form.expectedReturnDate,
      submittedBy: form.submittedBy.trim() || currentUser.fullName,
      applicantName: form.applicantName.trim(),
      officerNote: form.note.trim() || undefined,
      receiptImageUrl: receiptImageUrl || undefined,
      status: SUBMITTED_STATUS,
    });

    updateCase(selectedCase.id, {
      assignedTo: activeAssigneeId,
      priority: form.priority,
      receivedDate: form.submittedDate,
      internalDueDate: form.expectedReturnDate,
      promisedDate: form.expectedReturnDate,
      status: SUBMITTED_STATUS,
    });

    addActivityLog({
      organizationId: currentUser.organizationId,
      caseId: selectedCase.id,
      actorId: currentUser.id,
      action: entryMode === "ocr" ? "Tạo biên nhận hồ sơ từ OCR" : "Tạo biên nhận hồ sơ",
      entityType: "submissions",
      entityId: selectedCase.id,
      newValue: submissionCode,
    });

    resetOcr();
    setForm(initialFormState(currentUser.fullName));
    setSelectedCaseId(linkedCaseId);
    navigate("case-detail", { caseId: selectedCase.id });
  }

  const currentStep = WIZARD_STEPS[stepIndex];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-1">
          {WIZARD_STEPS.map((item, index) => (
            <div key={item} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${
                  index < stepIndex
                    ? "bg-green-500 text-white"
                    : index === stepIndex
                    ? "bg-[#ea580c] text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {index < stepIndex ? <Check size={12} /> : item}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${index < stepIndex ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Bước {currentStep}/7</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 pb-6">
        {stepIndex === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1a3a8a]">Chọn hồ sơ khách hàng</h2>
              <p className="text-xs text-gray-400 mt-1">
                Biên nhận sẽ gắn vào một hồ sơ khách hàng đã tạo trước. Bạn có thể chọn tay hoặc dùng OCR để gợi ý.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEntryMode("manual")}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  entryMode === "manual"
                    ? "bg-[#1a3a8a] text-white border-[#1a3a8a]"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                Nhập tay
              </button>
              <button
                onClick={() => setEntryMode("ocr")}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  entryMode === "ocr"
                    ? "bg-[#1a3a8a] text-white border-[#1a3a8a]"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                Dùng OCR
              </button>
            </div>

            {entryMode === "ocr" && (
              <div className="space-y-3">
                <label className="block cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-[#ea580c] hover:bg-orange-50 transition-colors">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                      {isProcessing ? (
                        <Loader2 size={28} className="text-[#ea580c] animate-spin" />
                      ) : (
                        <Camera size={28} className="text-[#ea580c]" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">
                        {isProcessing ? "Đang quét biên nhận..." : "Chụp ảnh hoặc chọn biên nhận"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG · OCR sẽ tự nhận khách hàng và thông tin nộp hồ sơ</p>
                    </div>
                  </div>
                </label>

                {ocrResult && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                      <p className="text-sm font-semibold text-green-700">OCR đã đọc được biên nhận</p>
                    </div>
                    <div className="text-xs text-green-700 space-y-1">
                      <p>Người nộp: {ocrResult.applicantName}</p>
                      <p>Thủ tục: {ocrResult.procedureType}</p>
                      <p>Mã biên nhận: {ocrResult.submissionCode}</p>
                    </div>
                    {ocrMode === "mock" ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Dữ liệu mẫu để test, chưa đọc nội dung ảnh thật.</p> : null}
                    {receiptImageUrl ? <img src={receiptImageUrl} alt="Biên nhận đã quét" className="max-h-52 w-full rounded-xl border border-green-200 object-contain bg-white" /> : null}
                    {receiptUploadError ? <p className="text-xs font-medium text-amber-700">Ảnh chưa lưu được: {receiptUploadError}</p> : null}
                    <button
                      onClick={resetOcr}
                      className="text-xs font-semibold text-green-700 hover:text-green-900 transition-colors"
                    >
                      Quét lại biên nhận
                    </button>
                  </div>
                )}
                {ocrError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700"><p>OCR chưa đọc được ảnh này: {ocrError}</p>{ocrBillingUrl ? <a href={ocrBillingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold underline">Mở trang bật thanh toán</a> : <p className="mt-2">Bạn có thể thử ảnh rõ hơn hoặc nhập tay.</p>}</div> : null}
              </div>
            )}

            <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5">
              <Search size={15} className="text-gray-400" />
              <input
                type="text"
                placeholder="Tìm hồ sơ theo khách hàng, mã HS hoặc dịch vụ..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="flex-1 outline-none text-sm bg-transparent"
              />
            </div>

            <div className="space-y-2 max-h-[26rem] overflow-y-auto">
              {suggestedCases.map(({ caseItem, customer, score }) => {
                const isSelected = activeCaseId === caseItem.id;
                const hasReceipt = data.submissions.some((submission) => submission.caseId === caseItem.id);

                return (
                  <button
                    key={caseItem.id}
                    onClick={() => setSelectedCaseId(caseItem.id)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${
                      isSelected ? "border-[#ea580c] bg-orange-50" : "border-gray-100 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-800">{customer?.fullName ?? "—"}</p>
                          {entryMode === "ocr" && score > 0 && (
                            <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              Gợi ý OCR
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#1a3a8a] font-medium mt-0.5">
                          {caseItem.caseCode} · {caseItem.serviceType}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {caseItem.promisedDate ? `Hẹn trả ${formatDate(caseItem.promisedDate)}` : "Chưa có lịch hẹn"} · Phí{" "}
                          {formatVnd(caseItem.serviceFee)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{hasReceipt ? "Đã có biên nhận" : "Chưa có biên nhận"}</p>
                      </div>
                      {isSelected && <BadgeCheck size={18} className="text-[#ea580c] shrink-0 mt-0.5" />}
                    </div>
                  </button>
                );
              })}

              {suggestedCases.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                  Chưa tìm thấy hồ sơ phù hợp.
                </div>
              )}
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1a3a8a]">Biên nhận và phân công</h2>
              <p className="text-xs text-gray-400 mt-1">Hoàn tất phần biên nhận hồ sơ, người phụ trách và lịch hẹn trả.</p>
            </div>

            {ocrResult && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-[#1a3a8a]">OCR đã điền sẵn dữ liệu biên nhận</p>
                <p className="text-xs text-blue-700 mt-1">Bạn vẫn có thể chỉnh lại trước khi lưu.</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Mã biên nhận *</span>
                <input
                  type="text"
                  value={form.submissionCode}
                  onChange={(event) => setFormField("submissionCode", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Loại thủ tục *</span>
                <input
                  type="text"
                  value={form.procedureType}
                  onChange={(event) => setFormField("procedureType", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Cơ quan tiếp nhận *</span>
                <input
                  type="text"
                  value={form.receivingAgency}
                  onChange={(event) => setFormField("receivingAgency", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Người nộp hồ sơ *</span>
                <input
                  type="text"
                  value={form.applicantName}
                  onChange={(event) => setFormField("applicantName", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Nhân viên nộp</span>
                <input
                  type="text"
                  value={form.submittedBy}
                  onChange={(event) => setFormField("submittedBy", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </label>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-400 mb-1 block">Ngày nộp *</span>
                  <input
                    type="date"
                    value={form.submittedDate}
                    onChange={(event) => setFormField("submittedDate", event.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-gray-400 mb-1 block">Ngày hẹn trả *</span>
                  <input
                    type="date"
                    value={form.expectedReturnDate}
                    onChange={(event) => setFormField("expectedReturnDate", event.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Người phụ trách *</span>
                <select
                  value={activeAssigneeId}
                  onChange={(event) => setFormField("assignedTo", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">Chọn người phụ trách</option>
                  {assignableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Ưu tiên</span>
                <select
                  value={form.priority}
                  onChange={(event) => setFormField("priority", event.target.value as Priority)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  {(["Thấp", "Trung bình", "Cao", "Khẩn"] as Priority[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Ghi chú biên nhận</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(event) => setFormField("note", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
                />
              </label>
            </div>
          </div>
        )}

        {stepIndex === 2 && selectedCase && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1a3a8a]">Xác nhận biên nhận hồ sơ</h2>
              <p className="text-xs text-gray-400 mt-1">Kiểm tra lại hồ sơ khách hàng được gắn và thông tin biên nhận trước khi lưu.</p>
            </div>

            <div className="bg-[#1a3a8a] rounded-2xl p-4 text-white">
              <p className="text-xs text-blue-200 mb-1">Hồ sơ khách hàng</p>
              <p className="text-xl font-extrabold">{selectedCase.caseCode}</p>
              <p className="text-sm text-blue-100 mt-1">{selectedCustomer?.fullName ?? "—"}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
              <SummaryRow icon={<User size={14} />} label="Khách hàng" value={selectedCustomer?.fullName ?? "—"} />
              <SummaryRow icon={<Building2 size={14} />} label="Dịch vụ" value={selectedCase.serviceType} />
              <SummaryRow icon={<FileText size={14} />} label="Mã biên nhận" value={form.submissionCode} mono />
              <SummaryRow icon={<FileText size={14} />} label="Thủ tục" value={form.procedureType} />
              <SummaryRow icon={<Building2 size={14} />} label="Cơ quan tiếp nhận" value={form.receivingAgency} />
              <SummaryRow icon={<CalendarDays size={14} />} label="Ngày nộp" value={formatDate(form.submittedDate)} />
              <SummaryRow icon={<CalendarDays size={14} />} label="Ngày hẹn trả" value={formatDate(form.expectedReturnDate)} />
              <SummaryRow
                icon={<User size={14} />}
                label="Người phụ trách"
                value={data.profiles.find((profile) => profile.id === activeAssigneeId)?.fullName ?? "—"}
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-[#ea580c] hover:bg-orange-600 text-white font-bold rounded-2xl py-4 transition-colors text-base"
            >
              Lưu biên nhận hồ sơ
            </button>
            {submitError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{submitError}</p> : null}
          </div>
        )}
      </div>

      <div className="px-4 py-4 bg-white border-t border-gray-100 flex gap-3">
        <button
          onClick={() => {
            if (stepIndex > 0) setStepIndex((currentStep) => currentStep - 1);
            else navigate("cases");
          }}
          className="flex items-center gap-1 px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
        >
          <ChevronLeft size={16} /> {stepIndex > 0 ? "Trước" : "Quay lại"}
        </button>

        {stepIndex < WIZARD_STEPS.length - 1 && (
          <button
            onClick={() => canProceed() && setStepIndex((currentStep) => currentStep + 1)}
            disabled={!canProceed()}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-[#1a3a8a] text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Tiếp theo <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm mt-0.5 text-gray-800 break-all ${mono ? "font-mono" : "font-semibold"}`}>{value}</p>
      </div>
    </div>
  );
}
