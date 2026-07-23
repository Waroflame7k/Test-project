export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;

export function validateUpload(file: File): string | null {
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) return "Chỉ cho phép ảnh JPG, PNG, WebP hoặc PDF.";
  if (file.size > MAX_UPLOAD_SIZE) return "Dung lượng file tối đa là 8MB.";
  return null;
}

export function storagePathForFile(fileName: string, id = crypto.randomUUID()): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  return `documents/${id}.${extension}`;
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxEdge = 1800;
  const ratio = Math.min(maxEdge / bitmap.width, maxEdge / bitmap.height, 1);
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
