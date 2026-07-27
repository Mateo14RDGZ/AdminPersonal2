import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { assistantTokensUsedThisMonth, logAssistantUsage, monthlyTokenLimit } from "@/lib/assistant-usage";
import { simpleAssistantPlan } from "@/lib/simple-assistant";

const actions = ["reply", "register_movement", "create_account", "create_category", "update_account_balance", "delete_account", "add_savings_plan", "create_card", "create_goal", "create_recurring_payment", "set_category_budget"] as const;
const dataSchema = z.object({ raw_text: z.string().nullable(), account_id: z.string().uuid().nullable(), category_id: z.string().uuid().nullable(), name: z.string().nullable(), institution: z.string().nullable(), account_type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), amount: z.number().finite().nullable(), target_amount: z.number().finite().nullable(), date: z.string().nullable() });
const planSchema = z.object({ action: z.enum(actions), message: z.string().min(1).max(500), data: dataSchema });
export type AssistantPlan = z.infer<typeof planSchema>;

function contentToJson(content: unknown): unknown {
  const text = Array.isArray(content) ? content.map((p) => typeof p === "object" && p && "text" in p ? String(p.text) : "").join("") : typeof content === "string" ? content : "";
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

export async function POST(request: NextRequest) {
  const session = await requireUser();
  if (session.error) return session.error;
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const history = Array.isArray(body?.history)
    ? body.history.slice(-8).flatMap((item: unknown) => {
        const message = item && typeof item === "object" ? item as Record<string, unknown> : null;
        return message && (message.role === "user" || message.role === "assistant") && typeof message.text === "string"
          ? [{ role: message.role, content: message.text.slice(0, 1000) }]
          : [];
      })
    : [];
  if (!text || text.length > 1000) return NextResponse.json({ error: "Escribi un mensaje valido." }, { status: 400 });
  const localPlan = simpleAssistantPlan(text);
  if (localPlan) return NextResponse.json({ plan: localPlan, requiresConfirmation: true, usedAI: false });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "La IA no esta configurada." }, { status: 503 });

  const supabase = await createClient();
  const [accounts, categories, cards, goals, recurring] = await Promise.all([
    supabase.from("accounts").select("id,name,institution,type,currency,current_balance").eq("user_id", session.user.id).eq("is_archived", false),
    supabase.from("categories").select("id,name,monthly_budget").eq("user_id", session.user.id),
    supabase.from("credit_cards").select("id,name,institution,currency,credit_limit,current_used_amount").eq("user_id", session.user.id).eq("is_archived", false),
    supabase.from("savings_goals").select("id,name,currency,target_amount,current_amount").eq("user_id", session.user.id).eq("is_archived", false),
    supabase.from("recurring_transactions").select("id,merchant,amount,currency,frequency,next_execution_date").eq("user_id", session.user.id).eq("is_active", true),
  ]);
  const context = JSON.stringify({ accounts: accounts.data ?? [], categories: categories.data ?? [], cards: cards.data ?? [], goals: goals.data ?? [], recurring: recurring.data ?? [] });
  const system = `You control a personal finance app. Return ONLY valid JSON with action, message and data. Allowed actions: ${actions.join(", ")}. Use create_category for a new category. Never invent IDs. Keep a natural Spanish conversation: when information is missing, use reply, ask one short question, and do not propose an action yet. When enough information exists, return the action so the user can confirm or cancel it. Financial changes must be proposed, not executed. Every data field raw_text, account_id, category_id, name, institution, account_type, currency, amount, target_amount and date must be present; use null when unused. User context: ${context}`;
  const limit = monthlyTokenLimit();
  let used = 0;
  try { used = await assistantTokensUsedThisMonth(session.user.id); } catch { return NextResponse.json({ error: "No se pudo verificar el uso de IA." }, { status: 503 }); }
  const estimated = Math.ceil((system.length + text.length) / 4) + 800;
  if (limit - used <= estimated) return NextResponse.json({ error: "Alcanzaste el limite mensual del asistente." }, { status: 429 });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "system", content: system }, ...history, { role: "user", content: text }], response_format: { type: "json_object" }, reasoning_effort: "minimal", max_completion_tokens: Math.min(900, limit - used - estimated) }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: typeof result?.error?.message === "string" ? `La IA no esta disponible: ${result.error.message}` : "La IA no esta disponible." }, { status: 502 });
    const parsed = planSchema.safeParse(contentToJson(result?.choices?.[0]?.message?.content));
    if (!parsed.success) { console.error("Invalid assistant plan", parsed.error.flatten()); return NextResponse.json({ error: "No pude interpretar la respuesta. Intenta expresarlo de otra forma." }, { status: 422 }); }
    await logAssistantUsage(session.user.id, Number(result?.usage?.total_tokens ?? 0));
    return NextResponse.json({ plan: parsed.data, requiresConfirmation: parsed.data.action !== "reply", remainingTokens: Math.max(0, limit - used - Number(result?.usage?.total_tokens ?? 0)), usedAI: true });
  } catch (error) {
    console.error("Assistant request failed", error);
    return NextResponse.json({ error: "No pude conectarme con la IA." }, { status: 502 });
  }
}
