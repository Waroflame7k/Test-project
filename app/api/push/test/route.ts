import { NextResponse } from "next/server";
import { sendTestPushNotification } from "@/services/push-notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string };
  if (!body.token) {
    return NextResponse.json({ error: "Thiếu token thiết bị." }, { status: 400 });
  }
  await sendTestPushNotification(body.token);
  return NextResponse.json({ ok: true });
}
