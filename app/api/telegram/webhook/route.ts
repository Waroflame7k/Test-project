import { NextResponse } from "next/server";
import { processTelegramUpdate, verifyTelegramWebhookSecret } from "@/services/telegram-bot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyTelegramWebhookSecret(request)) {
    return NextResponse.json({ ok: false, error: "Invalid Telegram secret." }, { status: 401 });
  }

  const update = await request.json();
  await processTelegramUpdate(update);
  return NextResponse.json({ ok: true });
}
