/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheFirst } from "workbox-strategies";
import { registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(caches.delete("api-cache"));
});

registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image",
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: "LaPesadilla Finanzas", body: event.data.text() };
  }
  const title = payload.title ?? "LaPesadilla Finanzas";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url ?? "/inicio" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          void (client as WindowClient).navigate(url);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

export {};
