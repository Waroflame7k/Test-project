import type { AppData, CaseProperty, Organization } from "@/types/domain";

export const APP_DATA_COLLECTION_KEYS = [
  "profiles",
  "customers",
  "properties",
  "cases",
  "caseProperties",
  "submissions",
  "documents",
  "custodyTransfers",
  "tasks",
  "payments",
  "activityLogs",
  "notifications",
] as const;

export type AppDataCollectionKey = (typeof APP_DATA_COLLECTION_KEYS)[number];
export type AppDataRecord = AppData[AppDataCollectionKey][number];

export interface AppDataCollectionMutation {
  upserts: AppDataRecord[];
  deleteIds: string[];
}

export interface AppDataMutation {
  organization?: Organization;
  collections: Partial<Record<AppDataCollectionKey, AppDataCollectionMutation>>;
}

export function appDataRecordId(key: AppDataCollectionKey, record: AppDataRecord) {
  if (key === "caseProperties") {
    const relation = record as CaseProperty;
    return `${relation.caseId}__${relation.propertyId}`;
  }
  return (record as { id: string }).id;
}

function recordsEqual(first: AppDataRecord, second: AppDataRecord) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function buildAppDataMutation(previous: AppData, next: AppData): AppDataMutation {
  const collections: AppDataMutation["collections"] = {};

  for (const key of APP_DATA_COLLECTION_KEYS) {
    const previousRecords = previous[key] as AppDataRecord[];
    const nextRecords = next[key] as AppDataRecord[];
    const previousById = new Map(previousRecords.map((record) => [appDataRecordId(key, record), record]));
    const nextById = new Map(nextRecords.map((record) => [appDataRecordId(key, record), record]));

    const upserts = nextRecords.filter((record) => {
      const current = previousById.get(appDataRecordId(key, record));
      return !current || !recordsEqual(current, record);
    });
    const deleteIds = [...previousById.keys()].filter((id) => !nextById.has(id));

    if (upserts.length > 0 || deleteIds.length > 0) {
      collections[key] = { upserts, deleteIds };
    }
  }

  return {
    organization: JSON.stringify(previous.organization) === JSON.stringify(next.organization) ? undefined : next.organization,
    collections,
  };
}

export function applyAppDataMutation(current: AppData, mutation: AppDataMutation): AppData {
  const next: AppData = {
    ...current,
    organization: mutation.organization ?? current.organization,
  };
  const mutableCollections = next as unknown as Record<AppDataCollectionKey, AppDataRecord[]>;

  for (const key of APP_DATA_COLLECTION_KEYS) {
    const change = mutation.collections[key];
    if (!change) continue;

    const deleted = new Set(change.deleteIds);
    const records = new Map(
      (current[key] as AppDataRecord[])
        .filter((record) => !deleted.has(appDataRecordId(key, record)))
        .map((record) => [appDataRecordId(key, record), record])
    );
    for (const record of change.upserts) {
      records.set(appDataRecordId(key, record), record);
    }
    mutableCollections[key] = [...records.values()];
  }

  return next;
}

export function hasAppDataMutationChanges(mutation: AppDataMutation) {
  return Boolean(mutation.organization || Object.keys(mutation.collections).length > 0);
}
