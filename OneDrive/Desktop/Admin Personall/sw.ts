/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheFirst, NetworkFirst, NetworkOnly } from "workbox-strategies";
import { registerRoute, setCatchHandler } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open("offline-shell").then((cache) => cache.add("/offline"))
  );
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(caches.delete("api-cache"));
});

// Never serve an old JavaScript or stylesheet bundle first. In an installed
// iPhone PWA that can leave the interface running a previous version even
// after a deployment. The cached version is only a fallback when offline.
registerRoute(
  ({ request }) => request.destination === "style" || request.destination === "script",
  new NetworkFirst({
    cacheName: "app-shell",
    networkTimeoutSeconds: 4,
  })
);

registerRoute(
  ({ request }) => request.destination === "font" || request.destination === "image",
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkOnly()
);

setCatchHandler(async ({ event }) => {
  const request = (event as FetchEvent).request;
  if (request.mode === "navigate") {
    return (await caches.match("/offline")) ?? Response.error();
  }
  return Response.error();
});

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
