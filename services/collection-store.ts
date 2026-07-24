import "server-only";
import { randomUUID } from "node:crypto";
import type { DocumentData, DocumentReference, Firestore, WriteBatch } from "firebase-admin/firestore";
import {
  APP_DATA_COLLECTION_KEYS,
  appDataRecordId,
  buildAppDataMutation,
  type AppDataCollectionKey,
  type AppDataMutation,
  type AppDataRecord,
} from "@/lib/app-data-mutation";
import { normalizeAppData } from "@/lib/data-normalization";
import { demoData } from "@/services/demo-data";
import { getFirebaseAdminDb } from "@/services/firebase-admin";
import type { AppData } from "@/types/domain";

const ORGANIZATIONS_COLLECTION = "organizations";
const LEGACY_COLLECTION = "system_state";
const LEGACY_DOCUMENT = "app_data";
const META_COLLECTION = "meta";
const SYNC_DOCUMENT = "sync";
const SCHEMA_VERSION = 2;
const MAX_BATCH_OPERATIONS = 400;

const COLLECTION_NAMES: Record<AppDataCollectionKey, string> = {
  profiles: "profiles",
  customers: "customers",
  properties: "properties",
  cases: "cases",
  caseProperties: "case_properties",
  submissions: "submissions",
  documents: "documents",
  custodyTransfers: "custody_transfers",
  tasks: "tasks",
  payments: "payments",
  activityLogs: "activity_logs",
  notifications: "notifications",
};

type WriteOperation =
  | { type: "set"; reference: DocumentReference; value: DocumentData; merge?: boolean }
  | { type: "delete"; reference: DocumentReference };

function cleanFirestoreValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyOperation(batch: WriteBatch, operation: WriteOperation) {
  if (operation.type === "delete") {
    batch.delete(operation.reference);
    return;
  }
  const value = cleanFirestoreValue(operation.value);
  if (operation.merge) {
    batch.set(operation.reference, value, { merge: true });
  } else {
    batch.set(operation.reference, value);
  }
}

async function commitOperations(db: Firestore, operations: WriteOperation[]) {
  for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + MAX_BATCH_OPERATIONS)) {
      applyOperation(batch, operation);
    }
    await batch.commit();
  }
}

function organizationReference(db: Firestore, organizationId: string) {
  return db.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
}

function syncReference(db: Firestore, organizationId: string) {
  return organizationReference(db, organizationId).collection(META_COLLECTION).doc(SYNC_DOCUMENT);
}

function collectionReference(db: Firestore, organizationId: string, key: AppDataCollectionKey) {
  return organizationReference(db, organizationId).collection(COLLECTION_NAMES[key]);
}

async function writeInitialCollectionData(db: Firestore, data: AppData) {
  const organizationId = data.organization.id;
  const organizationRef = organizationReference(db, organizationId);
  const operations: WriteOperation[] = [
    {
      type: "set",
      reference: organizationRef,
      value: {
        organization: data.organization,
        schemaVersion: SCHEMA_VERSION,
        migratedAt: new Date().toISOString(),
      },
    },
  ];

  for (const key of APP_DATA_COLLECTION_KEYS) {
    for (const record of data[key] as AppDataRecord[]) {
      operations.push({
        type: "set",
        reference: collectionReference(db, organizationId, key).doc(appDataRecordId(key, record)),
        value: record,
      });
    }
  }

  await commitOperations(db, operations);
  await syncReference(db, organizationId).set({
    revision: randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  });
}

async function resolveOrganizationId(db: Firestore) {
  const preferredId = process.env.APP_ORGANIZATION_ID?.trim() || demoData.organization.id;
  const preferredSnapshot = await organizationReference(db, preferredId).get();
  if (preferredSnapshot.exists && preferredSnapshot.data()?.schemaVersion === SCHEMA_VERSION) {
    return preferredId;
  }

  const existingOrganizations = await db.collection(ORGANIZATIONS_COLLECTION).limit(1).get();
  const existing = existingOrganizations.docs.find((document) => document.data()?.schemaVersion === SCHEMA_VERSION);
  if (existing) return existing.id;

  const legacySnapshot = await db.collection(LEGACY_COLLECTION).doc(LEGACY_DOCUMENT).get();
  const legacyData = legacySnapshot.data()?.data as AppData | undefined;
  const source = normalizeAppData(legacyData ?? demoData);
  await writeInitialCollectionData(db, source);
  return source.organization.id;
}

async function readResolvedCollectionData(db: Firestore, organizationId: string): Promise<AppData> {
  const organizationRef = organizationReference(db, organizationId);
  const [organizationSnapshot, ...collectionSnapshots] = await Promise.all([
    organizationRef.get(),
    ...APP_DATA_COLLECTION_KEYS.map((key) => collectionReference(db, organizationId, key).get()),
  ]);

  const organization = organizationSnapshot.data()?.organization ?? demoData.organization;
  const data = {
    organization,
  } as AppData;
  const mutableData = data as unknown as Record<AppDataCollectionKey, AppDataRecord[]>;

  APP_DATA_COLLECTION_KEYS.forEach((key, index) => {
    mutableData[key] = collectionSnapshots[index].docs.map((document) => document.data() as AppDataRecord);
  });

  return normalizeAppData(data);
}

export async function readCollectionAppData() {
  const db = getFirebaseAdminDb();
  if (!db) return null;
  const organizationId = await resolveOrganizationId(db);
  return readResolvedCollectionData(db, organizationId);
}

export async function applyCollectionAppDataMutation(mutation: AppDataMutation) {
  const db = getFirebaseAdminDb();
  if (!db) return null;
  const organizationId = await resolveOrganizationId(db);
  const operations: WriteOperation[] = [];

  if (mutation.organization) {
    operations.push({
      type: "set",
      reference: organizationReference(db, organizationId),
      value: {
        organization: mutation.organization,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      },
      merge: true,
    });
  }

  for (const key of APP_DATA_COLLECTION_KEYS) {
    const change = mutation.collections[key];
    if (!change) continue;
    const collection = collectionReference(db, organizationId, key);

    for (const record of change.upserts) {
      operations.push({
        type: "set",
        reference: collection.doc(appDataRecordId(key, record)),
        value: record,
      });
    }
    for (const id of change.deleteIds) {
      operations.push({ type: "delete", reference: collection.doc(id) });
    }
  }

  if (operations.length > 0) {
    await commitOperations(db, operations);
  }

  const revision = randomUUID();
  await syncReference(db, organizationId).set(
    {
      revision,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return { revision, organizationId };
}

export async function replaceCollectionAppData(incoming: AppData) {
  const current = await readCollectionAppData();
  if (!current) return null;
  const mutation = buildAppDataMutation(current, normalizeAppData(incoming));
  await applyCollectionAppDataMutation(mutation);
  return readCollectionAppData();
}

export async function getCollectionSyncReference() {
  const db = getFirebaseAdminDb();
  if (!db) return null;
  const organizationId = await resolveOrganizationId(db);
  return syncReference(db, organizationId);
}
