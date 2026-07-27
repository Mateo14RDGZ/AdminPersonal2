import webpush from "web-push";
import { createServiceClient } from "./supabase/service";

let configured = false;

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureVapid() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  try {
    ensureVapid();
  } catch {
    return { configured: false, sent: 0 };
  }

  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subs?.length) return { configured: true, sent: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/inicio",
  });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      }
    })
  );
  return { configured: true, sent: results.filter((result) => result.status === "fulfilled").length };
}
