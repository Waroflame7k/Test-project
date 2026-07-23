import { createHash } from "node:crypto";
import { getMessaging } from "firebase-admin/messaging";
import { getFirebaseAdminApp, getFirebaseAdminDb } from "@/services/firebase-admin";

function requireFirebase() {
  const app = getFirebaseAdminApp();
  const db = getFirebaseAdminDb();
  if (!app || !db) {
    throw new Error("Firebase chưa được cấu hình.");
  }
  return { app, db };
}

export async function savePushSubscription(input: { token: string; userId?: string }) {
  const { db } = requireFirebase();
  const id = createHash("sha256").update(input.token).digest("hex");
  await db.collection("push_subscriptions").doc(id).set(
    {
      token: input.token,
      userId: input.userId ?? null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function sendTestPushNotification(token: string) {
  const { app } = requireFirebase();
  return getMessaging(app).send({
    token,
    notification: {
      title: "Hồ sơ BĐS",
      body: "Thông báo push thử đã đến thiết bị của bạn.",
    },
    webpush: {
      fcmOptions: { link: "/" },
    },
  });
}
