import { NextResponse } from "next/server";
import { parseReceiptText } from "@/services/ocr";
import { getFirebaseAdminApp, isFirebaseConfigured } from "@/services/firebase-admin";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isFirebaseConfigured()) {
    return NextResponse.json({ error: "Firebase chưa được cấu hình cho OCR." }, { status: 503 });
  }
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_RECEIPT_SIZE) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh biên nhận tối đa 8 MB." }, { status: 400 });
  }

  const app = getFirebaseAdminApp();
  const credential = app?.options.credential;
  if (!credential) {
    return NextResponse.json({ error: "Không lấy được quyền truy cập OCR." }, { status: 503 });
  }

  const token = await credential.getAccessToken();
  const visionResponse = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: Buffer.from(await file.arrayBuffer()).toString("base64") }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }],
    }),
  });
  if (!visionResponse.ok) {
    const detail = (await visionResponse.json().catch(() => ({}))) as { error?: { message?: string } };
    return NextResponse.json({ error: detail.error?.message ?? "Google Vision không thể đọc biên nhận." }, { status: 502 });
  }

  const vision = (await visionResponse.json()) as { responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }> };
  const result = vision.responses?.[0];
  if (result?.error?.message) {
    return NextResponse.json({ error: result.error.message }, { status: 422 });
  }
  const text = result?.fullTextAnnotation?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Không đọc được chữ trên ảnh biên nhận." }, { status: 422 });
  }
  return NextResponse.json({ result: parseReceiptText(text), text });
}
