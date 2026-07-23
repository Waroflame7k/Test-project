import { NextResponse } from "next/server";
import { handleTelegramUpdate, isValidTelegramWebhook } from "@/services/telegram-digest";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isValidTelegramWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await handleTelegramUpdate(await request.json());
  return NextResponse.json({ ok: true });
}
