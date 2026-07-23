import { promises as fs } from "node:fs";
import path from "node:path";
import { demoData } from "@/services/demo-data";
import { getFirebaseAdminDb, isFirebaseConfigured } from "@/services/firebase-admin";
import { todayIso } from "@/lib/date";
import type {
  ActivityLog,
  AppData,
  Case,
  Customer,
  DocumentRecord,
  NotificationRecord,
  Profile,
} from "@/types/domain";

const DATA_DIR = path.join(process.cwd(), "data");
const APP_DATA_FILE = path.join(DATA_DIR, "app-data.shared.json");
const BOT_STATE_FILE = path.join(DATA_DIR, "telegram-bot.shared.json");
const FIRESTORE_SYSTEM_COLLECTION = "system_state";
const FIRESTORE_APP_STATE_DOC = "app_data";
const FIRESTORE_BOT_STATE_DOC = "telegram_bot_state";
const FIRESTORE_SUBSCRIBERS_COLLECTION = "telegram_subscribers";

export interface TelegramSubscriber {
  chatId: string;
  username?: string;
  firstName?: string;
  registeredAt: string;
}

export interface TelegramBotState {
  lastUpdateId: number;
  subscribers: TelegramSubscriber[];
  sentDigests: Record<string, string>;
}

const DEFAULT_BOT_STATE: TelegramBotState = {
  lastUpdateId: 0,
  subscribers: [],
  sentDigests: {},
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function recordTimestamp(value: { updatedAt?: string; createdAt?: string }) {
  return value.updatedAt ?? value.createdAt ?? "";
}

function mergeById<T extends { id: string }>(
  base: T[],
  incoming: T[],
  choose?: (current: T, next: T) => T
): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    const current = map.get(item.id);
    if (!current) {
      map.set(item.id, item);
      continue;
    }
    map.set(item.id, choose ? choose(current, item) : { ...current, ...item });
  }
  return [...map.values()];
}

function mergeCases(base: Case[], incoming: Case[]) {
  return mergeById(base, incoming, (current, next) =>
    recordTimestamp(next) >= recordTimestamp(current) ? { ...current, ...next } : current
  );
}

function mergeNotifications(base: NotificationRecord[], incoming: NotificationRecord[]) {
  return mergeById(base, incoming, (current, next) =>
    recordTimestamp(next) >= recordTimestamp(current) ? { ...current, ...next } : current
  ).sort((firstItem, secondItem) => secondItem.createdAt.localeCompare(firstItem.createdAt));
}

function mergeActivityLogs(base: ActivityLog[], incoming: ActivityLog[]) {
  return mergeById(base, incoming).sort((firstItem, secondItem) =>
    secondItem.createdAt.localeCompare(firstItem.createdAt)
  );
}

function mergeCaseProperties(base: AppData["caseProperties"], incoming: AppData["caseProperties"]) {
  const keyOf = (item: AppData["caseProperties"][number]) => `${item.caseId}::${item.propertyId}`;
  const map = new Map<string, AppData["caseProperties"][number]>();
  for (const item of [...base, ...incoming]) {
    map.set(keyOf(item), item);
  }
  return [...map.values()];
}

function sortByDateFieldDesc<T>(items: T[], getValue: (item: T) => string) {
  return [...items].sort((firstItem, secondItem) => getValue(secondItem).localeCompare(getValue(firstItem)));
}

export function mergeAppData(current: AppData, incoming: AppData): AppData {
  return {
    organization: incoming.organization ?? current.organization,
    profiles: mergeById(current.profiles, incoming.profiles),
    customers: mergeById(current.customers, incoming.customers),
    properties: mergeById(current.properties, incoming.properties),
    cases: mergeCases(current.cases, incoming.cases),
    caseProperties: mergeCaseProperties(current.caseProperties, incoming.caseProperties),
    submissions: sortByDateFieldDesc(
      mergeById(current.submissions, incoming.submissions, (currentItem, nextItem) =>
        recordTimestamp(nextItem) >= recordTimestamp(currentItem) ? { ...currentItem, ...nextItem } : currentItem
      ),
      (item) => item.createdAt
    ),
    documents: sortByDateFieldDesc(mergeById(current.documents, incoming.documents), (item) => item.createdAt),
    custodyTransfers: sortByDateFieldDesc(
      mergeById(current.custodyTransfers, incoming.custodyTransfers),
      (item) => item.transferredAt
    ),
    tasks: sortByDateFieldDesc(mergeById(current.tasks, incoming.tasks), (item) => item.createdAt),
    payments: sortByDateFieldDesc(mergeById(current.payments, incoming.payments), (item) => item.paymentDate),
    activityLogs: mergeActivityLogs(current.activityLogs, incoming.activityLogs),
    notifications: mergeNotifications(current.notifications, incoming.notifications),
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return deepClone(fallback);
  }
}

async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function readFirestoreAppData(): Promise<AppData | null> {
  const db = getFirebaseAdminDb();
  if (!db) {
    return null;
  }
  const snapshot = await db.collection(FIRESTORE_SYSTEM_COLLECTION).doc(FIRESTORE_APP_STATE_DOC).get();
  if (!snapshot.exists) {
    return null;
  }
  const data = snapshot.data()?.data;
  return (data as AppData | undefined) ?? null;
}

async function writeFirestoreAppData(data: AppData): Promise<void> {
  const db = getFirebaseAdminDb();
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  await db.collection(FIRESTORE_SYSTEM_COLLECTION).doc(FIRESTORE_APP_STATE_DOC).set(
    {
      data,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function readFirestoreSubscribers(): Promise<TelegramSubscriber[]> {
  const db = getFirebaseAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = await db.collection(FIRESTORE_SUBSCRIBERS_COLLECTION).get();
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        chatId: item.id,
        username: typeof data.username === "string" ? data.username : undefined,
        firstName: typeof data.firstName === "string" ? data.firstName : undefined,
        registeredAt: typeof data.registeredAt === "string" ? data.registeredAt : new Date().toISOString(),
      } satisfies TelegramSubscriber;
    })
    .sort((firstItem, secondItem) => firstItem.registeredAt.localeCompare(secondItem.registeredAt));
}

async function syncFirestoreSubscribers(subscribers: TelegramSubscriber[]): Promise<void> {
  const db = getFirebaseAdminDb();
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  await Promise.all(
    subscribers.map((subscriber) =>
      db.collection(FIRESTORE_SUBSCRIBERS_COLLECTION).doc(subscriber.chatId).set(
        {
          username: subscriber.username ?? null,
          firstName: subscriber.firstName ?? null,
          registeredAt: subscriber.registeredAt,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    )
  );
}

async function readFirestoreBotState(): Promise<TelegramBotState | null> {
  const db = getFirebaseAdminDb();
  if (!db) {
    return null;
  }
  const [stateSnapshot, subscribers] = await Promise.all([
    db.collection(FIRESTORE_SYSTEM_COLLECTION).doc(FIRESTORE_BOT_STATE_DOC).get(),
    readFirestoreSubscribers(),
  ]);
  const data = stateSnapshot.data();
  return {
    lastUpdateId: typeof data?.lastUpdateId === "number" ? data.lastUpdateId : 0,
    sentDigests: (data?.sentDigests as Record<string, string> | undefined) ?? {},
    subscribers,
  };
}

async function writeFirestoreBotState(state: TelegramBotState): Promise<void> {
  const db = getFirebaseAdminDb();
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  await Promise.all([
    db.collection(FIRESTORE_SYSTEM_COLLECTION).doc(FIRESTORE_BOT_STATE_DOC).set(
      {
        lastUpdateId: state.lastUpdateId,
        sentDigests: state.sentDigests,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ),
    syncFirestoreSubscribers(state.subscribers),
  ]);
}

export async function readSharedAppData(): Promise<AppData> {
  if (isFirebaseConfigured()) {
    const data = await readFirestoreAppData();
    if (!data) {
      await writeFirestoreAppData(demoData);
      return deepClone(demoData);
    }
    return data;
  }
  return readJsonFile(APP_DATA_FILE, demoData);
}

export async function writeSharedAppData(data: AppData): Promise<void> {
  if (isFirebaseConfigured()) {
    await writeFirestoreAppData(data);
    return;
  }
  await writeJsonFile(APP_DATA_FILE, data);
}

export async function upsertSharedAppData(incoming: AppData): Promise<AppData> {
  const current = await readSharedAppData();
  const merged = mergeAppData(current, incoming);
  await writeSharedAppData(merged);
  return merged;
}

export async function readTelegramBotState(): Promise<TelegramBotState> {
  if (isFirebaseConfigured()) {
    const state = await readFirestoreBotState();
    if (!state) {
      await writeFirestoreBotState(DEFAULT_BOT_STATE);
      return deepClone(DEFAULT_BOT_STATE);
    }
    return state;
  }
  return readJsonFile(BOT_STATE_FILE, DEFAULT_BOT_STATE);
}

export async function writeTelegramBotState(state: TelegramBotState): Promise<void> {
  if (isFirebaseConfigured()) {
    await writeFirestoreBotState(state);
    return;
  }
  await writeJsonFile(BOT_STATE_FILE, state);
}

export async function registerTelegramSubscriber(subscriber: TelegramSubscriber): Promise<TelegramBotState> {
  const state = await readTelegramBotState();
  const existing = state.subscribers.find((item) => item.chatId === subscriber.chatId);
  const nextState: TelegramBotState = existing
    ? {
        ...state,
        subscribers: state.subscribers.map((item) =>
          item.chatId === subscriber.chatId ? { ...item, ...subscriber } : item
        ),
      }
    : {
        ...state,
        subscribers: [...state.subscribers, subscriber],
      };
  await writeTelegramBotState(nextState);
  return nextState;
}

export async function updateTelegramOffset(updateId: number): Promise<void> {
  const state = await readTelegramBotState();
  if (updateId <= state.lastUpdateId) return;
  await writeTelegramBotState({ ...state, lastUpdateId: updateId });
}

export async function rememberSentDigest(key: string): Promise<void> {
  const state = await readTelegramBotState();
  await writeTelegramBotState({
    ...state,
    sentDigests: {
      ...state.sentDigests,
      [key]: todayIso(),
    },
  });
}

export async function wasDigestSentToday(key: string): Promise<boolean> {
  const state = await readTelegramBotState();
  return state.sentDigests[key] === todayIso();
}

export function findCaseByCode(data: AppData, caseCode: string) {
  const normalized = caseCode.trim().toLowerCase();
  return data.cases.find((caseItem) => caseItem.caseCode.toLowerCase() === normalized && !caseItem.archivedAt) ?? null;
}

export function primaryNotificationUsers(data: AppData): Profile[] {
  const priorityRoles = new Set(["admin", "manager"]);
  const selected = data.profiles.filter((profile) => profile.active && priorityRoles.has(profile.role));
  return selected.length > 0 ? selected : data.profiles.filter((profile) => profile.active);
}

export async function addBotNotification(input: {
  caseId?: string;
  title: string;
  message: string;
  userIds: string[];
}): Promise<NotificationRecord[]> {
  const data = await readSharedAppData();
  const createdAt = new Date().toISOString();
  const notifications = input.userIds.map((userId) => ({
    id: makeId("noti"),
    userId,
    caseId: input.caseId,
    title: input.title,
    message: input.message,
    notificationType: "telegram",
    createdAt,
  }));
  const next: AppData = {
    ...data,
    notifications: mergeNotifications(data.notifications, notifications),
  };
  await writeSharedAppData(next);
  return notifications;
}

export async function addBotDocument(input: {
  caseId: string;
  documentName: string;
  documentType: string;
  originalOrCopy: DocumentRecord["originalOrCopy"];
  quantity: number;
  currentHolderId?: string;
  fileUrl?: string;
  notes?: string;
  actorId: string;
}): Promise<DocumentRecord> {
  const data = await readSharedAppData();
  const createdAt = new Date().toISOString();
  const document: DocumentRecord = {
    id: makeId("doc"),
    caseId: input.caseId,
    documentName: input.documentName,
    documentType: input.documentType,
    originalOrCopy: input.originalOrCopy,
    quantity: input.quantity,
    confidential: false,
    currentHolderId: input.currentHolderId,
    fileUrl: input.fileUrl,
    notes: input.notes,
    receivedDate: todayIso(),
    createdAt,
  };
  const activityLog: ActivityLog = {
    id: makeId("log"),
    organizationId: data.organization.id,
    caseId: input.caseId,
    actorId: input.actorId,
    action: "Bot Telegram thêm tài liệu",
    entityType: "documents",
    entityId: document.id,
    newValue: document.documentName,
    createdAt,
  };
  const next: AppData = {
    ...data,
    documents: mergeById(data.documents, [document]),
    activityLogs: mergeActivityLogs(data.activityLogs, [activityLog]),
  };
  await writeSharedAppData(next);
  return document;
}

export async function addBotCustomer(input: Omit<Customer, "id" | "createdAt">): Promise<Customer> {
  const data = await readSharedAppData();
  const customer: Customer = {
    ...input,
    id: makeId("cust"),
    createdAt: new Date().toISOString(),
  };
  const next: AppData = {
    ...data,
    customers: mergeById(data.customers, [customer]),
  };
  await writeSharedAppData(next);
  return customer;
}
