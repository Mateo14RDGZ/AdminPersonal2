import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const PREFIX = "lpf_";

function pepper(): string {
  return process.env.AUTOMATION_TOKEN_PEPPER ?? "";
}

export function createAutomationToken(): string {
  return `${PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashAutomationToken(token: string): string {
  return createHash("sha256")
    .update(`${token}:${pepper()}`)
    .digest("hex");
}

export async function authenticateAutomationToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token.startsWith(PREFIX) || token.length < 32) return null;

  const supabase = createServiceClient();
  const tokenHash = hashAutomationToken(token);
  const { data } = await supabase
    .from("automation_tokens")
    .select("id,user_id,expires_at,is_active")
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!data || (data.expires_at && new Date(data.expires_at) <= new Date())) {
    return null;
  }

  await supabase
    .from("automation_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id, tokenId: data.id, supabase };
}

