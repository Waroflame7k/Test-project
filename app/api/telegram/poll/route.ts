import { NextResponse } from "next/server";
import { pullTelegramUpdates } from "@/services/telegram-bot";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const configured = process.env.TELEGRAM_POLL_SECRET?.trim();
  if (!configured) {
    return true;
  }
  return request.headers.get("x-telegram-poll-secret") === configured;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const result = await pullTelegramUpdates();
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
