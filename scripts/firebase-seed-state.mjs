import "./load-env.mjs";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local or environment.");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = getFirestore(app);
const dataDir = path.join(process.cwd(), "data");
const appDataPath = path.join(dataDir, "app-data.shared.json");

if (!existsSync(appDataPath)) {
  console.error(`Missing seed source: ${appDataPath}`);
  process.exit(1);
}

const appData = JSON.parse(readFileSync(appDataPath, "utf8"));
const collectionNames = {
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
const organizationRef = db.collection("organizations").doc(appData.organization.id);
const operations = [
  {
    reference: organizationRef,
    value: {
      organization: appData.organization,
      schemaVersion: 2,
      seededAt: new Date().toISOString(),
    },
  },
];

for (const [key, collectionName] of Object.entries(collectionNames)) {
  for (const record of appData[key]) {
    const id = key === "caseProperties" ? `${record.caseId}__${record.propertyId}` : record.id;
    operations.push({
      reference: organizationRef.collection(collectionName).doc(id),
      value: record,
    });
  }
}

for (let index = 0; index < operations.length; index += 400) {
  const batch = db.batch();
  for (const operation of operations.slice(index, index + 400)) {
    batch.set(operation.reference, operation.value);
  }
  await batch.commit();
}

await organizationRef.collection("meta").doc("sync").set({
  revision: randomUUID(),
  schemaVersion: 2,
  updatedAt: new Date().toISOString(),
});

console.log("Firebase seed completed successfully.");
