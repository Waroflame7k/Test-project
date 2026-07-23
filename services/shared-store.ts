import { promises as fs } from "node:fs";
import path from "node:path";
import { demoData } from "@/services/demo-data";
import { getFirebaseAdminDb, isFirebaseConfigured } from "@/services/firebase-admin";
import type {
  ActivityLog,
  AppData,
  Case,
  NotificationRecord,
} from "@/types/domain";

const DATA_DIR = path.join(process.cwd(), "data");
const APP_DATA_FILE = path.join(DATA_DIR, "app-data.shared.json");
const FIRESTORE_SYSTEM_COLLECTION = "system_state";
const FIRESTORE_APP_STATE_DOC = "app_data";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

async function upsertFirestoreAppData(incoming: AppData): Promise<AppData> {
  const db = getFirebaseAdminDb();
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const reference = db.collection(FIRESTORE_SYSTEM_COLLECTION).doc(FIRESTORE_APP_STATE_DOC);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = (snapshot.data()?.data as AppData | undefined) ?? demoData;
    const merged = mergeAppData(current, incoming);
    transaction.set(
      reference,
      {
        data: merged,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return merged;
  });
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
  if (isFirebaseConfigured()) {
    return upsertFirestoreAppData(incoming);
  }
  const current = await readSharedAppData();
  const merged = mergeAppData(current, incoming);
  await writeSharedAppData(merged);
  return merged;
}
