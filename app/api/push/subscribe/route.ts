import { NextResponse } from "next/server";
import { savePushSubscription } from "@/services/push-notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; userId?: string };
  if (!body.token) {
    return NextResponse.json({ error: "Thiếu token thiết bị." }, { status: 400 });
  }
  await savePushSubscription({ token: body.token, userId: body.userId });
  return NextResponse.json({ ok: true });
}
