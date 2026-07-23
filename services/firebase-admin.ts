import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function requiredFirebaseEnv() {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

export function isFirebaseConfigured() {
  const config = requiredFirebaseEnv();
  return Boolean(config.projectId && config.clientEmail && config.privateKey);
}

let firebaseApp: App | null = null;
let firestoreInstance: Firestore | null = null;

export function getFirebaseAdminApp() {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!firebaseApp) {
    const config = requiredFirebaseEnv();
    firebaseApp =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
      });
  }
  return firebaseApp;
}

export function getFirebaseAdminDb() {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
}
