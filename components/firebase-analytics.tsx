"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/services/firebase-web";

export function FirebaseAnalytics() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  return null;
}
