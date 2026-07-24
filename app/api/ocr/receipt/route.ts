import { NextResponse } from "next/server";
import { SERVICE_TYPES } from "@/lib/constants";
import { missingReceiptFields, normalizeProcedureType, normalizeSubmissionCode } from "@/services/ocr";
import type { OCRResult } from "@/services/ocr";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 8 * 1024 * 1024;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  error?: { message?: string };
};

type GeminiReceipt = Partial<Pick<OCRResult, "submissionCode" | "procedureType" | "receivingAgency" | "applicantName" | "submittedDate" | "expectedReturnDate">> & {
  confidence?: number;
};

const GEMINI_RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    submissionCode: { type: "string", description: "Mã hoặc số biên nhận/tiếp nhận, giữ nguyên dấu chấm và gạch nối." },
    procedureType: { type: "string", description: `Chọn một loại trong danh mục: ${SERVICE_TYPES.join(", ")}. Nếu ảnh không phải biên nhận thì trả chuỗi rỗng.` },
    receivingAgency: { type: "string", description: "Giữ nguyên tên cơ quan, khu vực hoặc nơi tiếp nhận ghi trên biên nhận." },
    applicantName: { type: "string", description: "Ưu tiên tên ngay sau dòng Tiếp nhận hồ sơ của; không lấy người đại diện, người được ủy quyền hoặc cán bộ." },
    submittedDate: { type: "string", description: "Ngày nộp hoặc ngày tiếp nhận theo YYYY-MM-DD; không lấy ngày lập." },
    expectedReturnDate: { type: "string", description: "Ngày hẹn trả hoặc ngày trả kết quả theo YYYY-MM-DD." },
    confidence: { type: "number", description: "Mức tự tin tổng thể từ 0 đến 1 dựa trên độ rõ của ảnh và khả năng đọc đúng các trường." },
  },
  required: ["submissionCode", "procedureType", "receivingAgency", "applicantName", "submittedDate", "expectedReturnDate", "confidence"],
};

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  const date = stringField(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const match = date.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

function normalizeAgency(value: unknown) {
  return stringField(value);
}

function geminiOcrModel() {
  const configuredModel = process.env.GEMINI_OCR_MODEL?.trim();
  if (!configuredModel || configuredModel === "gemini-flash-latest" || configuredModel === "gemini-flash-lite-latest") {
    return "gemini-3.5-flash-lite";
  }
  return configuredModel;
}

function extractJsonObject(text: string) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new Error("Gemini trả về dữ liệu không đúng định dạng. Hãy thử lại ảnh này.");
  }

  return normalized.slice(start, end + 1);
}

function parseGeminiReceipt(text: string): { result: OCRResult; confidence: number } {
  let payload: GeminiReceipt;
  try {
    payload = JSON.parse(extractJsonObject(text)) as GeminiReceipt;
  } catch {
    throw new Error("Gemini chưa trả đủ dữ liệu biên nhận. Hãy thử quét lại ảnh này.");
  }
  const result: OCRResult = {
    caseCode: "",
    submissionCode: normalizeSubmissionCode(stringField(payload.submissionCode)),
    procedureType: normalizeProcedureType(stringField(payload.procedureType)),
    receivingAgency: normalizeAgency(payload.receivingAgency),
    applicantName: stringField(payload.applicantName),
    submittedDate: normalizeDate(payload.submittedDate),
    expectedReturnDate: normalizeDate(payload.expectedReturnDate),
    submittedBy: "",
  };
  const statedConfidence =
    typeof payload.confidence === "number" && Number.isFinite(payload.confidence)
      ? Math.min(1, Math.max(0, payload.confidence))
      : 0;
  const completeness = 1 - missingReceiptFields(result).length / 6;
  return {
    result,
    confidence: Math.round((statedConfidence * 0.75 + completeness * 0.25) * 100),
  };
}

async function recognizeWithGemini(file: File) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Chưa cấu hình Gemini API key.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiOcrModel()}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Bạn là OCR cho ảnh chụp biên nhận hành chính Việt Nam, có thể nghiêng, tối hoặc có nền bàn/đồ vật. CHỈ trả JSON theo schema, không có lời dẫn hay markdown. Chỉ đọc nếu tiêu đề là GIẤY TIẾP NHẬN HỒ SƠ hoặc PHIẾU TIẾP NHẬN HỒ SƠ; nếu là hợp đồng hoặc tài liệu khác, để tất cả trường rỗng và confidence bằng 0. submissionCode lấy sau Số/Mã biên nhận, giữ nguyên phần mã chính và chỉ bỏ hậu tố cuối kiểu /TNHS. procedureType phải là một lựa chọn trong schema; trích đo hoặc đo đạc kiểm tra dùng Đo đạc. receivingAgency giữ nguyên tên cơ quan, khu vực hoặc nơi tiếp nhận ghi trên ảnh. applicantName bắt buộc ưu tiên tên ngay sau dòng TIẾP NHẬN HỒ SƠ CỦA; chỉ khi không có dòng này mới lấy NGƯỜI NỘP. Không lấy NGƯỜI ĐẠI DIỆN, người có tiền tố UQ, người được ủy quyền, cán bộ hoặc người ký nhận. submittedDate lấy thời gian nhận hồ sơ hoặc ngày tiếp nhận, không lấy ngày lập. expectedReturnDate lấy Ngày dự kiến đo đạc, Hẹn trả hoặc Trả kết quả. Chuẩn hóa ngày YYYY-MM-DD. confidence từ 0 đến 1, giảm điểm nếu ảnh mờ, nghiêng hoặc có trường không chắc chắn. Không rõ thì chuỗi rỗng.",
              },
              { inlineData: { mimeType: file.type || "image/jpeg", data: Buffer.from(await file.arrayBuffer()).toString("base64") } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RECEIPT_SCHEMA,
          thinkingConfig: { thinkingLevel: "MINIMAL" },
        },
      }),
    }
  );
  const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
  if (!response.ok) throw new Error(payload.error?.message ?? "Gemini không thể đọc biên nhận.");
  const text = payload.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini không trả về dữ liệu biên nhận.");
  return parseGeminiReceipt(text);
}

export async function GET() {
  return NextResponse.json({ mode: "gemini", configured: Boolean(process.env.GEMINI_API_KEY?.trim()) });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_RECEIPT_SIZE) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh biên nhận tối đa 8 MB." }, { status: 400 });
  }

  try {
    const recognized = await recognizeWithGemini(file);
    return NextResponse.json({
      result: recognized.result,
      confidence: recognized.confidence,
      missingFields: missingReceiptFields(recognized.result),
      mode: "gemini",
      model: geminiOcrModel(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini không thể đọc biên nhận.";
    if (/resource exhausted|quota|rate limit/i.test(message)) {
      return NextResponse.json({ error: "Gemini đã hết quota tạm thời. Hãy thử lại sau." }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
