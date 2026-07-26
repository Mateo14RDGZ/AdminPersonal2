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
    return () => window.removeEventListener("online", sync);
  }, []);

  return null;
}
