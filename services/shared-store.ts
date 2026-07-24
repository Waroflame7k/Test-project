import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { applyAppDataMutation, type AppDataMutation } from "@/lib/app-data-mutation";
import { normalizeAppData } from "@/lib/data-normalization";
import {
  applyCollectionAppDataMutation,
  readCollectionAppData,
  replaceCollectionAppData,
} from "@/services/collection-store";
import { demoData } from "@/services/demo-data";
import { isFirebaseConfigured } from "@/services/firebase-admin";
import type { AppData } from "@/types/domain";

const DATA_DIR = path.join(process.cwd(), "data");
const APP_DATA_FILE = path.join(DATA_DIR, "app-data.shared.json");

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readLocalAppData() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(APP_DATA_FILE, "utf8");
    return normalizeAppData(JSON.parse(raw) as AppData);
  } catch {
    await fs.writeFile(APP_DATA_FILE, JSON.stringify(demoData, null, 2), "utf8");
    return deepClone(demoData);
  }
}

async function writeLocalAppData(data: AppData) {
  await ensureDataDir();
  await fs.writeFile(APP_DATA_FILE, JSON.stringify(normalizeAppData(data), null, 2), "utf8");
}

export async function readSharedAppData(): Promise<AppData> {
  if (isFirebaseConfigured()) {
    return (await readCollectionAppData()) ?? deepClone(demoData);
  }
  return readLocalAppData();
}

export async function writeSharedAppData(data: AppData): Promise<void> {
  if (isFirebaseConfigured()) {
    await replaceCollectionAppData(normalizeAppData(data));
    return;
  }
  await writeLocalAppData(data);
}

export async function upsertSharedAppData(incoming: AppData): Promise<AppData> {
  const normalized = normalizeAppData(incoming);
  if (isFirebaseConfigured()) {
    return (await replaceCollectionAppData(normalized)) ?? normalized;
  }
  await writeLocalAppData(normalized);
  return normalized;
}

export async function applySharedAppDataMutation(mutation: AppDataMutation) {
  if (isFirebaseConfigured()) {
    const result = await applyCollectionAppDataMutation(mutation);
    return { ok: Boolean(result), revision: result?.revision };
  }

  const current = await readLocalAppData();
  const next = normalizeAppData(applyAppDataMutation(current, mutation));
  await writeLocalAppData(next);
  return { ok: true, revision: new Date().toISOString() };
}
