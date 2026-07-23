import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getFirebaseAdminStorageBucket, isFirebaseConfigured } from "@/services/firebase-admin";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isFirebaseConfigured()) {
    return NextResponse.json({ error: "Firebase Storage chưa được cấu hình." }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chưa chọn ảnh biên nhận." }, { status: 400 });
  }
  if (!file.type.startsWith("image/") || file.size > MAX_RECEIPT_SIZE) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh biên nhận tối đa 8 MB." }, { status: 400 });
  }

  const bucket = getFirebaseAdminStorageBucket();
  if (!bucket) {
    return NextResponse.json({ error: "Không kết nối được Firebase Storage." }, { status: 503 });
  }

  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  const objectPath = `receipts/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
  const token = randomUUID();
  const storageFile = bucket.file(objectPath);

  await storageFile.save(Buffer.from(await file.arrayBuffer()), {
    resumable: false,
    metadata: {
      contentType: file.type,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const encodedPath = encodeURIComponent(objectPath);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
  return NextResponse.json({ url });
}
