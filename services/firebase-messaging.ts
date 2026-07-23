"use client";

import { getFirebaseWebApp } from "@/services/firebase-web";

export async function requestPushToken() {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Chưa cấu hình khóa Web Push Firebase.");
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Thiết bị này chưa hỗ trợ thông báo web.");
  }

  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") {
    throw new Error("Bạn chưa cho phép thông báo trên thiết bị này.");
  }

  const app = getFirebaseWebApp();
  if (!app) {
    throw new Error("Firebase web chưa được cấu hình.");
  }

  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) {
    throw new Error("Trình duyệt này chưa hỗ trợ Firebase Cloud Messaging.");
  }

  const registration = await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
}
