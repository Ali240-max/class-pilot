"use client";

import { useEffect } from "react";

/** Registers the service worker (offline fallback + installability) in production. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: the app works without it.
    });
  }, []);
  return null;
}
