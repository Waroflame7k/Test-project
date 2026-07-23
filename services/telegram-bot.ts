import { isDueSoon, isOverdue, todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { receivableForCase } from "@/lib/case-utils";
import type { AppData, DocumentRecord } from "@/types/domain";
import {
  addBotDocument,
  addBotNotification,
  findCaseByCode,
  primaryNotificationUsers,
  readSharedAppData,
  readTelegramBotState,
  registerTelegramSubscriber,
  rememberSentDigest,
  updateTelegramOffset,
  wasDigestSentToday,
} from "@/services/shared-store";

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
}

interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  caption?: string;
  from?: TelegramUser;
  chat: TelegramChat;
  photo?: TelegramPhoto[];
  document?: TelegramDocument;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramGetFileResponse {
  ok: boolean;
  result?: {
    file_path?: string;
  };
}

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

function getTelegramWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
}

function hasTelegramBotConfig() {
  return Boolean(getTelegramBotToken());
}

async function telegramApi<T>(method: string, payload?: Record<string, unknown>): Promise<T> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN.");
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function verifyTelegramWebhookSecret(request: Request) {
  const configured = getTelegramWebhookSecret();
  return Boolean(configured) && request.headers.get("x-telegram-bot-api-secret-token") === configured;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  if (!hasTelegramBotConfig()) {
    return { skipped: true };
  }
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
  });
}

async function getTelegramFileUrl(fileId: string) {
  const token = getTelegramBotToken();
  if (!token) {
    return undefined;
  }
  const response = await telegramApi<TelegramGetFileResponse>("getFile", { file_id: fileId });
  const filePath = response.result?.file_path;
  if (!filePath) {
    return `telegram://file/${fileId}`;
  }
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

function normalizeCommandText(message: TelegramMessage) {
  return (message.text ?? message.caption ?? "").trim();
}

function parsePipeValues(raw: string) {
  return raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function caseSummary(data: AppData, caseCode: string) {
  const caseItem = findCaseByCode(data, caseCode);
  if (!caseItem) {
    return null;
  }
  const customer = data.customers.find((item) => item.id === caseItem.customerId);
  const documents = data.documents.filter((item) => item.caseId === caseItem.id);
  const submissions = data.submissions.filter((item) => item.caseId === caseItem.id);
  const paid = data.payments
    .filter((item) => item.caseId === caseItem.id && item.paymentType === "Thu")
    .reduce((sum, item) => sum + item.amount, 0);
  const receivable = receivableForCase(caseItem, data.payments);
  return [
    `Ho so ${caseItem.caseCode}`,
    `Khach: ${customer?.fullName ?? "Chua ro"}`,
    `Dich vu: ${caseItem.serviceType}`,
    `Trang thai: ${caseItem.status}`,
    `Hen tra: ${caseItem.promisedDate || "Chua co"}`,
    `Lan nop: ${submissions.length}`,
    `Tai lieu: ${documents.length}`,
    `Da thu: ${formatVnd(paid)}`,
    `Con phai thu: ${formatVnd(receivable)}`,
  ].join("\n");
}

function dashboardSummary(data: AppData) {
  const today = todayIso();
  const visibleCases = data.cases.filter((item) => !item.archivedAt);
  const activeCases = visibleCases.filter((item) => item.status !== "Hoàn tất");
  const dueSoon = activeCases.filter((item) => isDueSoon(item.promisedDate, today)).length;
  const overdue = activeCases.filter((item) => isOverdue(item.promisedDate, today)).length;
  return [
    "Tong quan ho so",
    `Tong ho so: ${visibleCases.length}`,
    `Dang xu ly: ${activeCases.length}`,
    `Sap han: ${dueSoon}`,
    `Qua han: ${overdue}`,
  ].join("\n");
}

function helpMessage() {
  return [
    "Bot ho so BDS da san sang.",
    "",
    "Lenh ho tro:",
    "/start - dang ky nhan thong bao",
    "/help - xem huong dan",
    "/cases - xem tong quan ho so",
    "/case HS-2026-0073 - xem nhanh 1 ho so",
    "/notify HS-2026-0073 | Noi dung thong bao",
    "/document HS-2026-0073 | Ten tai lieu | Loai tai lieu | Ban scan | 1 | Ghi chu",
    "",
    "Gui file tai lieu:",
    "Gui photo/document kem caption:",
    "HS-2026-0073 | Bien nhan nop ho so | Bien nhan | Ban scan | 1 | tu Telegram",
  ].join("\n");
}

function pickBotActorId(data: AppData) {
  return primaryNotificationUsers(data)[0]?.id ?? data.profiles[0]?.id ?? "telegram-bot";
}

async function handleStart(message: TelegramMessage) {
  await registerTelegramSubscriber({
    chatId: String(message.chat.id),
    username: message.from?.username,
    firstName: message.from?.first_name,
    registeredAt: new Date().toISOString(),
  });
  return "Da dang ky Telegram thanh cong.\n\n" + helpMessage();
}

async function handleCaseLookup(message: TelegramMessage, commandBody: string) {
  const data = await readSharedAppData();
  const code = commandBody.trim();
  if (!code) {
    return "Vui long nhap ma ho so. Vi du: /case HS-2026-0073";
  }
  const summary = caseSummary(data, code);
  return summary ?? `Khong tim thay ho so ${code}.`;
}

async function handleNotify(commandBody: string) {
  const [caseCode, ...messageParts] = parsePipeValues(commandBody);
  if (!caseCode || messageParts.length === 0) {
    return "Dung cu phap: /notify HS-2026-0073 | Noi dung thong bao";
  }
  const data = await readSharedAppData();
  const caseItem = findCaseByCode(data, caseCode);
  if (!caseItem) {
    return `Khong tim thay ho so ${caseCode}.`;
  }
  const message = messageParts.join(" | ");
  const targetUsers = data.profiles;
  await addBotNotification({
    caseId: caseItem.id,
    title: `Thong bao ho so ${caseItem.caseCode}`,
    message,
    userIds: targetUsers.map((item) => item.id),
  });
  const state = await readTelegramBotState();
  const telegramText = [`[THÔNG BÁO] ${caseItem.caseCode}`, message].join("\n");
  const results = await Promise.allSettled(
    state.subscribers.map((subscriber) => sendTelegramMessage(subscriber.chatId, telegramText)),
  );
  const sentToTelegram = results.filter((result) => result.status === "fulfilled").length;
  return `Đã tạo thông báo cho ${caseItem.caseCode} và gửi ${sentToTelegram}/${state.subscribers.length} tài khoản Telegram.`;
}

async function handleDocument(commandBody: string, message?: TelegramMessage) {
  const [caseCode, documentName, documentType, originalOrCopyRaw, quantityRaw, ...noteParts] =
    parsePipeValues(commandBody);
  if (!caseCode || !documentName || !documentType) {
    return "Dung cu phap: /document HS-2026-0073 | Ten tai lieu | Loai tai lieu | Ban scan | 1 | Ghi chu";
  }
  const data = await readSharedAppData();
  const caseItem = findCaseByCode(data, caseCode);
  if (!caseItem) {
    return `Khong tim thay ho so ${caseCode}.`;
  }
  const actorId = pickBotActorId(data);
  const fileId =
    message?.document?.file_id ??
    (message?.photo && message.photo.length > 0 ? message.photo[message.photo.length - 1].file_id : undefined);
  const fileUrl = fileId ? await getTelegramFileUrl(fileId) : undefined;
  const document = await addBotDocument({
    caseId: caseItem.id,
    documentName,
    documentType,
    originalOrCopy: normalizeOriginalOrCopy(originalOrCopyRaw),
    quantity: Math.max(1, Number(quantityRaw || "1") || 1),
    currentHolderId: caseItem.assignedTo,
    fileUrl,
    notes: [
      noteParts.join(" | "),
      fileId ? `telegram_file_id=${fileId}` : "",
      message?.document?.file_name ? `file_name=${message.document.file_name}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    actorId,
  });
  return `Da them tai lieu "${document.documentName}" vao ${caseItem.caseCode}.`;
}

function normalizeOriginalOrCopy(value?: string): DocumentRecord["originalOrCopy"] {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.includes("chinh")) return "Bản chính";
  if (normalized.includes("sao")) return "Bản sao";
  return "Bản scan";
}

function parseCommand(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const [command, ...rest] = trimmed.split(" ");
  return {
    command: command.toLowerCase(),
    body: rest.join(" ").trim(),
  };
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  if (!update.message) {
    await updateTelegramOffset(update.update_id + 1);
    return { handled: false, reason: "no-message" };
  }

  const message = update.message;
  const text = normalizeCommandText(message);
  const parsed = parseCommand(text);
  let reply = "";

  if (parsed?.command === "/start") {
    reply = await handleStart(message);
  } else if (parsed?.command === "/help") {
    reply = helpMessage();
  } else if (parsed?.command === "/cases") {
    reply = dashboardSummary(await readSharedAppData());
  } else if (parsed?.command === "/case") {
    reply = await handleCaseLookup(message, parsed.body);
  } else if (parsed?.command === "/notify") {
    reply = await handleNotify(parsed.body);
  } else if (parsed?.command === "/document") {
    reply = await handleDocument(parsed.body, message);
  } else if ((message.document || message.photo) && text) {
    reply = await handleDocument(text, message);
  } else {
    reply = helpMessage();
  }

  await sendTelegramMessage(String(message.chat.id), reply);
  await updateTelegramOffset(update.update_id + 1);
  return { handled: true };
}

export async function pullTelegramUpdates() {
  if (!hasTelegramBotConfig()) {
    return { ok: false, processed: 0, message: "Missing TELEGRAM_BOT_TOKEN." };
  }
  const state = await readTelegramBotState();
  const result = await telegramApi<{ ok: boolean; result: TelegramUpdate[] }>("getUpdates", {
    offset: state.lastUpdateId,
    timeout: 1,
    allowed_updates: ["message"],
  });
  const updates = result.result ?? [];
  for (const update of updates) {
    await processTelegramUpdate(update);
  }
  return { ok: true, processed: updates.length };
}

export async function dispatchDueCaseNotifications() {
  if (!hasTelegramBotConfig()) {
    return { ok: false, sent: 0, message: "Missing TELEGRAM_BOT_TOKEN." };
  }
  const data = await readSharedAppData();
  const state = await readTelegramBotState();
  const today = todayIso();
  const activeCases = data.cases.filter((item) => !item.archivedAt && item.status !== "Hoàn tất");
  const targets = activeCases.filter(
    (item) => (item.promisedDate && isOverdue(item.promisedDate, today)) || isDueSoon(item.promisedDate, today)
  );

  let sent = 0;
  for (const caseItem of targets) {
    const digestKey = `${caseItem.id}:${caseItem.status}:${caseItem.promisedDate}`;
    if (await wasDigestSentToday(digestKey)) {
      continue;
    }
    const customer = data.customers.find((item) => item.id === caseItem.customerId);
    const level = isOverdue(caseItem.promisedDate, today) ? "QUA HAN" : "SAP HAN";
    const text = [
      `[${level}] ${caseItem.caseCode}`,
      `Khach: ${customer?.fullName ?? "Chua ro"}`,
      `Dich vu: ${caseItem.serviceType}`,
      `Trang thai: ${caseItem.status}`,
      `Hen tra: ${caseItem.promisedDate}`,
    ].join("\n");
    const results = await Promise.allSettled(
      state.subscribers.map((subscriber) => sendTelegramMessage(subscriber.chatId, text)),
    );
    sent += results.filter((result) => result.status === "fulfilled").length;
    await rememberSentDigest(digestKey);
  }
  return { ok: true, sent };
}

export { hasTelegramBotConfig };
