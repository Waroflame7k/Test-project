import "./load-env.mjs";
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
const botStatePath = path.join(dataDir, "telegram-bot.shared.json");

if (!existsSync(appDataPath)) {
  console.error(`Missing seed source: ${appDataPath}`);
  process.exit(1);
}

const appData = JSON.parse(readFileSync(appDataPath, "utf8"));
const botState = existsSync(botStatePath)
  ? JSON.parse(readFileSync(botStatePath, "utf8"))
  : {
      lastUpdateId: 0,
      subscribers: [],
      sentDigests: {},
    };

await db.collection("system_state").doc("app_data").set(
  {
    data: appData,
    updatedAt: new Date().toISOString(),
  },
  { merge: true }
);

await db.collection("system_state").doc("telegram_bot_state").set(
  {
    lastUpdateId: Number(botState.lastUpdateId ?? 0),
    sentDigests: botState.sentDigests ?? {},
    updatedAt: new Date().toISOString(),
  },
  { merge: true }
);

await Promise.all(
  (botState.subscribers ?? []).map((subscriber) =>
    db.collection("telegram_subscribers").doc(String(subscriber.chatId)).set(
      {
        username: subscriber.username ?? null,
        firstName: subscriber.firstName ?? null,
        registeredAt: subscriber.registeredAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
  )
);

console.log("Firebase seed completed successfully.");
