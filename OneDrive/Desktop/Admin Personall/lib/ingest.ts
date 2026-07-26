import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { matchCategoryFromRules } from "@/lib/categorize";
import { sendPushToUser } from "@/lib/push-server";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { ingestBodySchema } from "@/lib/validation";

const INGEST_USER_ID = process.env.INGEST_USER_ID;

function authorizeIngest(request: NextRequest): Response | null {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return Response.json({ error: "Ingest not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = rateLimitKey(request, secret.slice(0, 8));
  if (!checkRateLimit(key)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!INGEST_USER_ID) {
    return Response.json({ error: "INGEST_USER_ID not configured" }, { status: 503 });
  }
  return null;
}

export async function handleIngest(
  request: NextRequest,
  source: "shortcut" | "email"
) {
  const authError = authorizeIngest(request);
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ingestBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, merchant, card_name, occurred_at } = parsed.data;
  const userId = INGEST_USER_ID!;
  const supabase = createServiceClient();

  const { data: rules } = await supabase
    .from("merchant_rules")
    .select("*")
    .eq("user_id", userId);

  const categoryId = matchCategoryFromRules(
    merchant ?? null,
    rules ?? []
  );

  const occurredAt = occurred_at ?? new Date().toISOString();

  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      amount,
      merchant: merchant ?? null,
      card_name: card_name ?? null,
      category_id: categoryId,
      source,
      occurred_at: occurredAt,
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const merchantLabel = merchant?.trim() || "Gasto";
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);

  await sendPushToUser(userId, {
    title: "Gasto registrado",
    body: `${merchantLabel} · ${formatted}`,
    url: "/inicio",
  });

  return Response.json({ ok: true, id: tx.id });
}
