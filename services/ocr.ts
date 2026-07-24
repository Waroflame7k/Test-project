import { SERVICE_TYPES } from "@/lib/constants";
import type { Customer, Profile } from "@/types/domain";

export interface OCRResult {
  caseCode: string;
  submittedDate: string;
  expectedReturnDate: string;
  procedureType: string;
  receivingAgency: string;
  submittedBy: string;
  applicantName: string;
  submissionCode: string;
}

const RECEIPT_FIELDS = [
  ["submissionCode", "Mã biên nhận"],
  ["procedureType", "Loại thủ tục"],
  ["receivingAgency", "Cơ quan tiếp nhận"],
  ["applicantName", "Người nộp hồ sơ"],
  ["submittedDate", "Ngày nộp"],
  ["expectedReturnDate", "Ngày hẹn trả"],
] as const satisfies ReadonlyArray<readonly [keyof OCRResult, string]>;

export function normalizeSubmissionCode(value: string) {
  return value.trim().replace(/\/[A-Za-zÀ-ỹ]+$/u, "").trim();
}

function comparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

export function normalizeProcedureType(value: string) {
  const normalized = comparableText(value);
  if (!normalized) return "";

  const exact = SERVICE_TYPES.find((type) => comparableText(type) === normalized);
  if (exact) return exact;

  const aliases: Array<[string[], (typeof SERVICE_TYPES)[number]]> = [
    [["sang ten", "chuyen nhuong"], "Sang tên"],
    [["tang cho"], "Tặng cho"],
    [["thua ke"], "Thừa kế"],
    [["tach thua"], "Tách thửa"],
    [["hop thua"], "Hợp thửa"],
    [["chuyen muc dich"], "Chuyển mục đích"],
    [["cap doi"], "Cấp đổi"],
    [["cap lai"], "Cấp lại"],
    [["dinh chinh"], "Đính chính"],
    [["trich luc"], "Trích lục"],
    [["xin phep xay dung"], "Xin phép xây dựng"],
    [["boi thuong"], "Hồ sơ bồi thường"],
    [["do dac", "trich do"], "Đo đạc"],
  ];

  return aliases.find(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[1] ?? "";
}

export function normalizePersonName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi-VN");
}

function editDistance(first: string, second: string) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[second.length];
}

function nameSimilarity(first: string, second: string) {
  const normalizedFirst = normalizePersonName(first).replace(/\s/g, "");
  const normalizedSecond = normalizePersonName(second).replace(/\s/g, "");
  if (!normalizedFirst || !normalizedSecond) return 0;
  if (normalizedFirst === normalizedSecond) return 1;
  if (normalizedFirst.includes(normalizedSecond) || normalizedSecond.includes(normalizedFirst)) return 0.9;
  return 1 - editDistance(normalizedFirst, normalizedSecond) / Math.max(normalizedFirst.length, normalizedSecond.length);
}

export interface CustomerNameMatch {
  customerId: string;
  customerName: string;
  confidence: number;
}

export function matchCustomerByName(
  applicantName: string,
  customers: Customer[],
  profiles: Profile[]
): CustomerNameMatch | null {
  const normalizedApplicant = normalizePersonName(applicantName);
  if (!normalizedApplicant) return null;

  const isEmployee = profiles
    .filter((profile) => profile.active)
    .some((profile) => normalizePersonName(profile.fullName) === normalizedApplicant);
  if (isEmployee) return null;

  const candidates = customers
    .map((customer) => ({
      customer,
      score: nameSimilarity(applicantName, customer.fullName),
    }))
    .sort((first, second) => second.score - first.score);
  const best = candidates[0];
  if (!best || best.score < 0.78) return null;

  return {
    customerId: best.customer.id,
    customerName: best.customer.fullName,
    confidence: Math.round(best.score * 100),
  };
}

export function missingReceiptFields(result: OCRResult) {
  return RECEIPT_FIELDS.filter(([key]) => !result[key].trim()).map(([, label]) => label);
}
