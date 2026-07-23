import "server-only";
import { daysUntil, formatDate, todayIso } from "@/lib/date";
import { isCaseActive } from "@/lib/case-utils";
import { getFirebaseAdminDb } from "@/services/firebase-admin";
import { readSharedAppData } from "@/services/shared-store";
import type { AppData, Case, Submission } from "@/types/domain";

const SUBSCRIBERS_COLLECTION = "telegram_subscribers";
const NEAR_DUE_DAYS = 5;

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

function requireBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("Telegram bot is not configured.");
  }
  return token;
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = requireBotToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_notification: false, disable_web_page_preview: true }),
  });

  if (!response.ok) {
    throw new Error(`Telegram rejected the message (${response.status}).`);
  }
}

function latestSubmissionsByCase(submissions: Submission[]) {
  const latest = new Map<string, Submission>();
  for (const submission of submissions) {
    const current = latest.get(submission.caseId);
    if (!current || submission.submittedDate > current.submittedDate) {
      latest.set(submission.caseId, submission);
    }
  }
  return latest;
}

function deadlineFor(caseItem: Case, latestSubmissions: Map<string, Submission>) {
  return latestSubmissions.get(caseItem.id)?.expectedReturnDate || caseItem.promisedDate;
}

function deadlineLabel(date: string, today: string) {
  const remainingDays = daysUntil(date, today);
  if (remainingDays < 0) return `Quá hạn ${Math.abs(remainingDays)} ngày`;
  if (remainingDays === 0) return "Đến hạn hôm nay";
  return `Còn ${remainingDays} ngày`;
}

function buildDailyDigest(data: AppData) {
  const today = todayIso();
  const customerNames = new Map(data.customers.map((customer) => [customer.id, customer.fullName]));
  const latestSubmissions = latestSubmissionsByCase(data.submissions);
  const dueTodayTasks = data.tasks
    .filter((task) => task.status !== "Hoàn thành" && task.dueDate === today)
    .sort((firstTask, secondTask) => (firstTask.dueTime ?? "99:99").localeCompare(secondTask.dueTime ?? "99:99"));
  const nearDueCases = data.cases
    .filter((caseItem) => {
      const date = deadlineFor(caseItem, latestSubmissions);
      const remainingDays = date ? daysUntil(date, today) : Number.POSITIVE_INFINITY;
      return isCaseActive(caseItem.status) && remainingDays <= NEAR_DUE_DAYS;
    })
    .sort((firstCase, secondCase) =>
      deadlineFor(firstCase, latestSubmissions).localeCompare(deadlineFor(secondCase, latestSubmissions))
    );

  const lines = [`Cập nhật hồ sơ - ${formatDate(today)}`];
  lines.push("");
  lines.push(`Công việc đến hạn hôm nay: ${dueTodayTasks.length}`);
  if (dueTodayTasks.length) {
    for (const task of dueTodayTasks.slice(0, 10)) {
      const customerName = customerNames.get(data.cases.find((caseItem) => caseItem.id === task.caseId)?.customerId ?? "");
      lines.push(`- ${task.dueTime ? `${task.dueTime} ` : ""}${task.title}${customerName ? ` (${customerName})` : ""}`);
    }
    if (dueTodayTasks.length > 10) lines.push(`- Và ${dueTodayTasks.length - 10} công việc khác`);
  } else {
    lines.push("- Không có công việc đến hạn hôm nay.");
  }

  lines.push("");
  lines.push(`Hồ sơ sắp hoặc đã đến hạn: ${nearDueCases.length}`);
  if (nearDueCases.length) {
    for (const caseItem of nearDueCases.slice(0, 12)) {
      const date = deadlineFor(caseItem, latestSubmissions);
      lines.push(`- ${customerNames.get(caseItem.customerId) ?? "Chưa có khách hàng"}: ${caseItem.serviceType}, ${deadlineLabel(date, today)} (${formatDate(date)})`);
    }
    if (nearDueCases.length > 12) lines.push(`- Và ${nearDueCases.length - 12} hồ sơ khác`);
  } else {
    lines.push("- Không có hồ sơ sắp hạn trong 5 ngày tới.");
  }

  return { text: lines.join("\n"), dueTodayTasks: dueTodayTasks.length, nearDueCases: nearDueCases.length };
}

export function isValidTelegramWebhook(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return Boolean(secret && request.headers.get("x-telegram-bot-api-secret-token") === secret);
}

export function isValidCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (!chatId || !text || !text.startsWith("/start")) return;

  const db = getFirebaseAdminDb();
  if (!db) throw new Error("Firebase is not configured.");

  const subscriberId = String(chatId);
  await db.collection(SUBSCRIBERS_COLLECTION).doc(subscriberId).set(
    { chatId: subscriberId, active: true, subscribedAt: new Date().toISOString() },
    { merge: true }
  );
  await sendTelegramMessage(
    subscriberId,
    "Bạn đã đăng ký nhận báo cáo lúc 08:00 mỗi ngày: công việc đến hạn hôm nay và hồ sơ sắp/quá hạn."
  );
}

export async function sendDailyTelegramDigest() {
  const db = getFirebaseAdminDb();
  if (!db) throw new Error("Firebase is not configured.");

  const subscribers = await db.collection(SUBSCRIBERS_COLLECTION).where("active", "==", true).get();
  const digest = buildDailyDigest(await readSharedAppData());
  let sent = 0;
  for (const subscriber of subscribers.docs) {
    try {
      await sendTelegramMessage(String(subscriber.data().chatId), digest.text);
      sent += 1;
    } catch {
      // A blocked bot must not prevent notifications to the remaining subscribers.
    }
  }
  return { sent, subscribers: subscribers.size, ...digest };
}
