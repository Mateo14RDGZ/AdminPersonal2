"use client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushStatus = "active" | "inactive" | "unsupported";

export async function getPushStatus(): Promise<PushStatus> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "granted") return "inactive";
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) ? "active" : "inactive";
}

export async function subscribeToPush(): Promise<{ ok: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Push no soportado en este navegador." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Permiso de notificaciones denegado." };
  }

  const reg = await navigator.serviceWorker.ready;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return { ok: false, message: "Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY." };
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });

  if (!res.ok) {
    return { ok: false, message: "No se pudo guardar la suscripción." };
  }

  return { ok: true, message: "Notificaciones activadas." };
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendPushTest(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch("/api/push/test", { method: "POST" });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    message: typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "No se pudo enviar la notificacion de prueba.",
  };
}
