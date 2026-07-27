import { createServiceClient } from "@/lib/supabase/service";

const DEFAULT_MONTHLY_TOKEN_LIMIT = 30_000;

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function monthlyTokenLimit() {
  const configured = Number(process.env.AI_MONTHLY_TOKEN_LIMIT);
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.floor(configured)
    : DEFAULT_MONTHLY_TOKEN_LIMIT;
}

export async function assistantTokensUsedThisMonth(userId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("audit_logs")
    .select("metadata")
    .eq("user_id", userId)
    .eq("action", "assistant_request")
    .gte("created_at", monthStart());
  if (error) throw error;
  return (data ?? []).reduce((total, entry) => {
    const metadata = entry.metadata as { total_tokens?: unknown } | null;
    const tokens = Number(metadata?.total_tokens ?? 0);
    return total + (Number.isFinite(tokens) ? tokens : 0);
  }, 0);
}

export async function logAssistantUsage(userId: string, totalTokens: number) {
  const service = createServiceClient();
  const { error } = await service.from("audit_logs").insert({
    user_id: userId,
    action: "assistant_request",
    entity_type: "assistant",
    entity_id: null,
    metadata: { total_tokens: Math.max(0, Math.floor(totalTokens)) },
  });
  if (error) throw error;
}
