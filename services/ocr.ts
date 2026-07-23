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

export interface OCRProvider {
  extractReceipt(file: File): Promise<OCRResult>;
}

export function parseReceiptText(text: string): OCRResult {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const dates = Array.from(text.matchAll(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/g)).map((match) => `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`);
  const submissionCode = text.match(/\b[A-Z]{1,4}[.\-\/]?[A-Z0-9]{2,}(?:[.\-\/][A-Z0-9]{2,}){1,}\b/i)?.[0] ?? "";
  const agency = lines.find((line) => /hành chính|ủy ban|ubnd|văn phòng|chi nhánh|bộ phận/i.test(line)) ?? "";
  const procedure = lines.find((line) => /sang tên|tặng cho|thừa kế|tách thửa|hợp thửa|cấp đổi|cấp lại|đính chính|trích lục/i.test(line)) ?? "";
  const applicantLabelIndex = lines.findIndex((line) => /họ (và )?tên|người nộp|người yêu cầu/i.test(line));
  const applicantName = applicantLabelIndex >= 0 ? lines[applicantLabelIndex].replace(/^.*?(họ (và )?tên|người nộp|người yêu cầu)\s*[:\-]?\s*/i, "") || lines[applicantLabelIndex + 1] || "" : "";

  return {
    caseCode: "",
    submittedDate: dates[0] ?? "",
    expectedReturnDate: dates[1] ?? "",
    procedureType: procedure,
    receivingAgency: agency,
    submittedBy: "",
    applicantName,
    submissionCode,
  };
}

export class MockOCRProvider implements OCRProvider {
  async extractReceipt(file: File): Promise<OCRResult> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const fingerprint = Array.from(`${file.name}:${file.size}:${file.lastModified}`).reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
      7
    );
    const submittedAt = new Date(file.lastModified || Date.now());
    const expectedAt = new Date(submittedAt);
    expectedAt.setDate(expectedAt.getDate() + 14);
    const formatIsoDate = (value: Date) => value.toISOString().slice(0, 10);
    return {
      caseCode: "",
      submittedDate: formatIsoDate(submittedAt),
      expectedReturnDate: formatIsoDate(expectedAt),
      procedureType: "Dữ liệu mẫu cần kiểm tra",
      receivingAgency: "Dữ liệu mẫu cần kiểm tra",
      submittedBy: "",
      applicantName: "Dữ liệu mẫu cần kiểm tra",
      submissionCode: `TEST-${String(fingerprint).padStart(8, "0")}`,
    };
  }
}
