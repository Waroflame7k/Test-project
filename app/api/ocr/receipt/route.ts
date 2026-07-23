import { NextResponse } from "next/server";
import { parseReceiptText } from "@/services/ocr";
import { getFirebaseAdminApp, isFirebaseConfigured } from "@/services/firebase-admin";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 8 * 1024 * 1024;

type VisionResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
};

async function detectText(accessToken: string, imageContent: string, type: "TEXT_DETECTION" | "DOCUMENT_TEXT_DETECTION") {
  const response = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content: imageContent }, features: [{ type }] }] }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(detail.error?.message ?? "Google Vision không thể đọc biên nhận.");
  }
  const vision = (await response.json()) as VisionResponse;
  const result = vision.responses?.[0];
  if (result?.error?.message) throw new Error(result.error.message);
  return result?.fullTextAnnotation?.text?.trim() ?? result?.textAnnotations?.[0]?.description?.trim() ?? "";
}

function hasCoreReceiptFields(result: ReturnType<typeof parseReceiptText>) {
  return Boolean(result.submissionCode && result.submittedDate && result.expectedReturnDate && result.receivingAgency);
}

export async function POST(request: Request) {
  if (!isFirebaseConfigured()) return NextResponse.json({ error: "Firebase chưa được cấu hình cho OCR." }, { status: 503 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_RECEIPT_SIZE) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh biên nhận tối đa 8 MB." }, { status: 400 });
  }

  const credential = getFirebaseAdminApp()?.options.credential;
  if (!credential) return NextResponse.json({ error: "Không lấy được quyền truy cập OCR." }, { status: 503 });

  try {
    const token = await credential.getAccessToken();
    const imageContent = Buffer.from(await file.arrayBuffer()).toString("base64");
    // Clear receipts use quick OCR; only incomplete results use the detailed, slower mode.
    const fastText = await detectText(token.access_token, imageContent, "TEXT_DETECTION");
    const fastResult = parseReceiptText(fastText);
    if (fastText && hasCoreReceiptFields(fastResult)) {
      return NextResponse.json({ result: fastResult, text: fastText, mode: "fast" });
    }

    const detailedText = await detectText(token.access_token, imageContent, "DOCUMENT_TEXT_DETECTION");
    if (!detailedText) return NextResponse.json({ error: "Không đọc được chữ trên ảnh biên nhận." }, { status: 422 });
    return NextResponse.json({ result: parseReceiptText(detailedText), text: detailedText, mode: "detailed" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Vision không thể đọc biên nhận." }, { status: 502 });
  }
}
