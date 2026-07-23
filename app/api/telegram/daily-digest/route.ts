import { NextResponse } from "next/server";
import { isValidCronRequest, sendDailyTelegramDigest } from "@/services/telegram-digest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendDailyTelegramDigest());
}
