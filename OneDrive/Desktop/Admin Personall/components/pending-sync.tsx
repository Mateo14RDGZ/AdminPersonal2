"use client";

import { useEffect } from "react";
import { flushPending } from "@/lib/pending-queue";

export function PendingSync() {
  useEffect(() => {
    const sync = () => {
      void flushPending((body) =>
        fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
    };
    sync();
    window.addEventListener("online", sync);
    const refreshForNewServiceWorker = () => {
      const refreshKey = "lap-pwa-controller-version";
      if (window.sessionStorage.getItem(refreshKey) === window.location.href) return;
      window.sessionStorage.setItem(refreshKey, window.location.href);
      window.location.reload();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", refreshForNewServiceWorker);
      void navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", sync);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("controllerchange", refreshForNewServiceWorker);
    };
  }, []);

  return null;
}
