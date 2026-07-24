"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  AlertTriangle,
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
import {
  matchCustomerByName,
  missingReceiptFields,
  normalizePersonName,
  normalizeSubmissionCode,
  type OCRResult,
} from "@/services/ocr";
import { formatDate, todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { SERVICE_TYPES } from "@/lib/constants";
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
  assignedTo: string;
  priority: Priority;
  note: string;
}

const initialFormState = (): ReceiptFormState => ({
  submissionCode: "",
  procedureType: "",
  receivingAgency: "",
  submittedDate: todayIso(),
  expectedReturnDate: "",
  assignedTo: "",
  priority: DEFAULT_PRIORITY,
  note: "",
});

async function optimizeReceiptImage(file: File) {
  if (!file.type.startsWith("image/")) return file;

  try {
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = sourceUrl;
      });
      const maxEdge = 1280;
      const isAlreadyOptimized =
        file.type === "image/jpeg" && file.size <= 900 * 1024 && Math.max(image.naturalWidth, image.naturalHeight) <= maxEdge;
      if (isAlreadyOptimized) return file;
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!blob) return file;

      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  } catch {
    return file;
  }
}

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
  const [ocrDurationMs, setOcrDurationMs] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState<ReceiptFormState>(initialFormState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assignableProfiles = useMemo(() => {
    return data.profiles.filter(
      (profile) => profile.active && (profile.role === "legal_staff" || profile.role === "manager" || profile.role === "admin")
    );
  }, [data.profiles]);

  const availableCases = useMemo(() => {
    return data.cases.filter((caseItem) => !caseItem.archivedAt);
  }, [data.cases]);

  const customerMatch = useMemo(
    () => (ocrResult ? matchCustomerByName(ocrResult.applicantName, data.customers, data.profiles) : null),
    [data.customers, data.profiles, ocrResult]
  );

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
          const customerName = normalizePersonName(customer.fullName);
          const applicantName = normalizePersonName(ocrResult.applicantName);
          const procedureType = ocrResult.procedureType.toLowerCase();

          if (applicantName) {
            if (customerMatch?.customerId === customer.id || customerName === applicantName) score += 4;
            else if (customerName.includes(applicantName) || applicantName.includes(customerName)) score += 2;
          }

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
  }, [availableCases, customerMatch?.customerId, data, ocrResult, search]);

  const suggestedCaseId =
    !selectedCaseId && ocrResult && suggestedCases[0]?.score > 0 ? suggestedCases[0].caseItem.id : "";
  const activeCaseId = linkedCaseId || selectedCaseId || suggestedCaseId;
  const activeAssigneeId = form.assignedTo || assignableProfiles[0]?.id || "";
  const selectedCase = availableCases.find((caseItem) => caseItem.id === activeCaseId) ?? null;
  const selectedCustomer = selectedCase
    ? data.customers.find((customer) => customer.id === selectedCase.customerId) ?? null
    : null;
  const missingOcrFields = ocrResult ? missingReceiptFields(ocrResult) : [];
  const normalizedCurrentCode = normalizeSubmissionCode(form.submissionCode).toLocaleLowerCase("vi-VN");
  const duplicateSubmission = normalizedCurrentCode
    ? data.submissions.find(
        (submission) =>
          normalizeSubmissionCode(submission.submissionCode).toLocaleLowerCase("vi-VN") === normalizedCurrentCode
      )
    : undefined;
  const duplicateCase = duplicateSubmission
    ? data.cases.find((caseItem) => caseItem.id === duplicateSubmission.caseId)
    : undefined;
  const duplicateCustomer = duplicateCase
    ? data.customers.find((customer) => customer.id === duplicateCase.customerId)
    : undefined;
  const confidenceLabel = ocrConfidence >= 85 ? "Cao" : ocrConfidence >= 65 ? "Trung bình" : "Thấp";

  useEffect(() => {
    if (entryMode !== "ocr") return;
    void fetch("/api/ocr/receipt").catch(() => undefined);
  }, [entryMode]);

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
    setOcrDurationMs(0);
    setOcrConfidence(0);
    setSubmitError("");
    setOcrResult(null);
    setForm((previous) => ({
      ...previous,
      submissionCode: "",
      procedureType: "",
      receivingAgency: "",
      submittedDate: todayIso(),
      expectedReturnDate: "",
    }));
    const startedAt = performance.now();
    try {
      const optimizedFile = await optimizeReceiptImage(file);
      const ocrForm = new FormData();
      ocrForm.set("file", optimizedFile);
      const ocrResponse = await fetch("/api/ocr/receipt", { method: "POST", body: ocrForm });
      if (!ocrResponse.ok) {
        const ocr = (await ocrResponse.json().catch(() => ({}))) as { error?: string; billingUrl?: string };
        setOcrError(ocr.error ?? "Không thể đọc biên nhận này.");
        setOcrBillingUrl(ocr.billingUrl ?? "");
        return;
      }
      const { result, confidence } = (await ocrResponse.json()) as { result: OCRResult; confidence?: number };
      setOcrResult(result);
      setOcrConfidence(typeof confidence === "number" ? confidence : 0);
      const uploadForm = new FormData();
      uploadForm.set("file", optimizedFile);
      const uploadResponse = await fetch("/api/receipts/upload", { method: "POST", body: uploadForm });
      if (uploadResponse.ok) {
        const upload = (await uploadResponse.json()) as { url: string };
        setReceiptImageUrl(upload.url);
      } else {
        const upload = (await uploadResponse.json().catch(() => ({}))) as { error?: string };
        setReceiptImageUrl("");
        setReceiptUploadError(upload.error ?? "Không thể lưu ảnh biên nhận.");
      }
      setForm((previous) => ({
        ...previous,
        submissionCode: normalizeSubmissionCode(result.submissionCode),
        procedureType: result.procedureType,
        receivingAgency: result.receivingAgency,
        submittedDate: result.submittedDate,
        expectedReturnDate: result.expectedReturnDate,
      }));
      setEntryMode("ocr");
      if (!linkedCaseId) setSelectedCaseId("");
      setStepIndex(0);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "Không thể quét biên nhận này.");
    } finally {
      setOcrDurationMs(Math.round(performance.now() - startedAt));
      setIsProcessing(false);
    }
  }

  function resetOcr() {
    setOcrResult(null);
    setReceiptImageUrl("");
    setReceiptUploadError("");
    setOcrError("");
    setOcrBillingUrl("");
    setOcrDurationMs(0);
    setOcrConfidence(0);
    setSubmitError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm((prev) => ({
      ...prev,
      submissionCode: "",
      procedureType: "",
      receivingAgency: "",
      submittedDate: todayIso(),
      expectedReturnDate: "",
    }));
  }

  function canProceed(): boolean {
    if (stepIndex === 0) {
      return Boolean(activeCaseId);
    }

    if (stepIndex === 1) {
      return Boolean(
        !duplicateSubmission &&
        form.submissionCode.trim() &&
          form.procedureType.trim() &&
          form.receivingAgency.trim() &&
          form.submittedDate &&
          form.expectedReturnDate &&
          activeAssigneeId
      );
    }

    return true;
  }

  function handleSubmit() {
    if (!selectedCase) return;
    const submissionCode = normalizeSubmissionCode(form.submissionCode);
    if (duplicateSubmission) {
      const location = [duplicateCustomer?.fullName, duplicateCase?.caseCode].filter(Boolean).join(" · ");
      setSubmitError(
        `Mã biên nhận ${submissionCode} đã tồn tại${location ? ` tại ${location}` : ""}. Hãy kiểm tra lại trước khi lưu.`
      );
      return;
    }

    addSubmission({
      caseId: selectedCase.id,
      submissionCode,
      procedureType: form.procedureType.trim(),
      receivingAgency: form.receivingAgency.trim(),
      submittedDate: form.submittedDate,
      expectedReturnDate: form.expectedReturnDate,
      submittedBy: currentUser.fullName,
      applicantName: selectedCustomer?.fullName ?? "",
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
    setForm(initialFormState());
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
                    <p className="text-xs font-semibold text-green-800">
                      Nguồn quét: Gemini API
                      {ocrDurationMs > 0 ? ` · ${(ocrDurationMs / 1000).toFixed(1)} giây` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          ocrConfidence >= 85
                            ? "bg-emerald-100 text-emerald-800"
                            : ocrConfidence >= 65
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        Độ tin cậy: {ocrConfidence}% · {confidenceLabel}
                      </span>
                      {customerMatch ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                          <BadgeCheck size={13} />
                          Khớp khách: {customerMatch.customerName} ({customerMatch.confidence}%)
                        </span>
                      ) : null}
                    </div>
                    <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">Gemini đã đọc và trích xuất dữ liệu từ ảnh. Hãy đối chiếu lại trước khi lưu.</p>
                    {missingOcrFields.length > 0 ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        Cần kiểm tra hoặc nhập thêm: {missingOcrFields.join(", ")}.
                      </p>
                    ) : (
                      <p className="rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-800">Đã đọc đủ các trường cần thiết. Vui lòng đối chiếu ảnh trước khi lưu.</p>
                    )}
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
                {duplicateSubmission ? (
                  <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Mã biên nhận đã tồn tại</p>
                      <p className="mt-1 text-xs">
                        {duplicateCustomer?.fullName ?? "Khách hàng chưa xác định"}
                        {duplicateCase ? ` · ${duplicateCase.caseCode}` : ""}
                      </p>
                    </div>
                  </div>
                ) : null}
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

            {selectedCase && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                <div className="min-w-0"><p className="text-xs text-blue-600">Hồ sơ khách hàng</p><p className="truncate text-sm font-bold text-[#1a3a8a]">{selectedCustomer?.fullName ?? "—"} · {selectedCase.caseCode}</p></div>
                {!linkedCaseId ? <button type="button" onClick={() => setStepIndex(0)} className="shrink-0 text-xs font-bold text-[#1a3a8a] underline">Đổi hồ sơ</button> : null}
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
                {duplicateSubmission ? (
                  <span className="mt-1.5 block text-xs font-semibold text-rose-700">
                    Mã này đã có ở {duplicateCustomer?.fullName ?? "một khách hàng khác"}
                    {duplicateCase ? ` · ${duplicateCase.caseCode}` : ""}. Không thể lưu trùng.
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Loại thủ tục *</span>
                <select
                  value={form.procedureType}
                  onChange={(event) => setFormField("procedureType", event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">Chọn loại thủ tục</option>
                  {SERVICE_TYPES.map((serviceType) => <option key={serviceType} value={serviceType}>{serviceType}</option>)}
                </select>
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
              {ocrResult ? (
                <SummaryRow
                  icon={<BadgeCheck size={14} />}
                  label="Độ tin cậy OCR"
                  value={`${ocrConfidence}% · ${confidenceLabel}`}
                />
              ) : null}
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
