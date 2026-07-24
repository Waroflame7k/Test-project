import { NextResponse } from "next/server";
import { sendTelegramTaskCreatedNotifications } from "@/services/telegram-digest";
import type { AppData, CaseTask } from "@/types/domain";

export const runtime = "nodejs";

interface TaskCreatedRequest {
  data: Pick<AppData, "cases" | "customers" | "profiles">;
  task: CaseTask;
}

export async function POST(request: Request) {
  const body = (await request.json()) as TaskCreatedRequest;
  if (!body.task?.id || !body.task.title || !body.task.caseId || !body.data?.cases || !body.data.customers || !body.data.profiles) {
    return NextResponse.json({ error: "Invalid task notification payload." }, { status: 400 });
  }

  try {
    const result = await sendTelegramTaskCreatedNotifications(
      body.data,
      [body.task]
    );
    return NextResponse.json(result);
  } catch (error) {
    // Notifications are best-effort and must never block task creation in the app.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send Telegram notification." },
      { status: 202 }
    );
  }
}
