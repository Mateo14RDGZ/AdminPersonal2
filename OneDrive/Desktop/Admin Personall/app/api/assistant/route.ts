import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { assistantTokensUsedThisMonth, logAssistantUsage, monthlyTokenLimit } from "@/lib/assistant-usage";
import { simpleAssistantPlan } from "@/lib/simple-assistant";

const actions = ["reply", "register_movement", "create_account", "create_category", "update_account_balance", "delete_account", "add_savings_plan", "add_income_plan", "create_card", "create_goal", "create_recurring_payment", "set_category_budget"] as const;
const dataSchema = z.object({ raw_text: z.string().nullable(), account_id: z.string().uuid().nullable(), category_id: z.string().uuid().nullable(), name: z.string().nullable(), institution: z.string().nullable(), account_type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), amount: z.number().finite().nullable(), target_amount: z.number().finite().nullable(), date: z.string().nullable(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable() });
const planSchema = z.object({ action: z.enum(actions), message: z.string().min(1).max(500), data: dataSchema });
const draftSchema = z.object({ action: z.enum(actions).nullable(), data: dataSchema }).nullable();
export type AssistantPlan = z.infer<typeof planSchema>;
type AssistantDraft = z.infer<typeof draftSchema>;

const emptyPlanData = { raw_text: null, account_id: null, category_id: null, name: null, institution: null, account_type: null, currency: null, amount: null, target_amount: null, date: null, color: null };

function mergeDraftData(draft: AssistantDraft, suppliedData: Record<string, unknown>) {
  const base = draft?.data ?? emptyPlanData;
  return Object.fromEntries(
    Object.entries(emptyPlanData).map(([key, fallback]) => {
      const supplied = suppliedData[key];
      return [key, supplied !== null && supplied !== undefined && supplied !== "" ? supplied : base[key as keyof typeof base] ?? fallback];
    })
  );
}

function normalizePlan(value: unknown, draft: AssistantDraft): { plan: AssistantPlan; intendedAction: (typeof actions)[number] | null } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const suppliedData = candidate.data && typeof candidate.data === "object" ? candidate.data as Record<string, unknown> : {};
  const normalized = {
    action: typeof candidate.action === "string" && actions.includes(candidate.action as (typeof actions)[number]) ? candidate.action : "reply",
    message: typeof candidate.message === "string" && candidate.message.trim() ? candidate.message.trim() : "Necesito un dato mas para continuar.",
    data: mergeDraftData(draft, suppliedData),
  };
  const result = planSchema.safeParse(normalized);
  if (!result.success) return null;
  const plan = result.data;
  const data = { ...plan.data };
  if (plan.action === "create_account") {
    data.currency ??= "UYU";
    data.account_type ??= "CHECKING";
    data.amount ??= 0;
  }
  if (plan.action === "create_category") data.color ??= "#64748B";
  const completedPlan = { ...plan, data };
  const missing = completedPlan.action === "create_account"
    ? !completedPlan.data.name ? "el nombre de la cuenta" : null
    : completedPlan.action === "create_card"
      ? !completedPlan.data.name ? "el nombre de la tarjeta" : !completedPlan.data.currency ? "la moneda" : completedPlan.data.amount == null ? "el límite de crédito" : null
      : completedPlan.action === "create_goal"
        ? !completedPlan.data.name ? "el nombre de la meta" : !completedPlan.data.currency ? "la moneda" : !completedPlan.data.target_amount ? "el objetivo de ahorro" : null
        : completedPlan.action === "create_recurring_payment"
          ? !completedPlan.data.name ? "el nombre del pago" : !completedPlan.data.currency ? "la moneda" : !completedPlan.data.amount ? "el importe" : !completedPlan.data.date ? "la próxima fecha de vencimiento" : null
          : null;
  return {
    plan: missing ? { action: "reply", message: `Para continuar solo necesito ${missing}.`, data: completedPlan.data } : completedPlan,
    intendedAction: completedPlan.action === "reply" ? null : completedPlan.action,
  };
}

function contentToJson(content: unknown): unknown {
  const text = Array.isArray(content) ? content.map((p) => typeof p === "object" && p && "text" in p ? String(p.text) : "").join("") : typeof content === "string" ? content : "";
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

type AccountContext = { id: string; name: string; institution: string | null; type: string; currency: string };

function explicitAccountMention(text: string, accounts: AccountContext[]) {
  const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const cash = /\b(?:efectivo|cash)\b/.test(normalized);
  const phrase = normalized.match(/\b(?:en|a|desde|con|del|de la)\s+(?:la |el |mi )?(?:cuenta )?([\p{L}\p{N} -]+?)(?:\s+(?:en|para|por)\s+|$)/u)?.[1]?.trim();
  const hint = cash ? "efectivo" : phrase?.replace(/^cuenta\s+/, "") ?? null;
  if (!hint) return { explicit: false, accountId: null, name: null };
  const account = accounts.find((candidate) => {
    const candidateName = candidate.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const institution = (candidate.institution ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return (cash && candidate.type === "CASH") || candidateName.includes(hint) || institution.includes(hint) || hint.includes(candidateName);
  });
  return { explicit: true, accountId: account?.id ?? null, name: hint };
}

export async function POST(request: NextRequest) {
  const session = await requireUser();
  if (session.error) return session.error;
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const history = Array.isArray(body?.history)
    ? body.history.slice(-16).flatMap((item: unknown) => {
        const message = item && typeof item === "object" ? item as Record<string, unknown> : null;
        return message && (message.role === "user" || message.role === "assistant") && typeof message.text === "string"
          ? [{ role: message.role, content: message.text.slice(0, 1000) }]
          : [];
      })
    : [];
  const draftResult = draftSchema.safeParse(body?.draft ?? null);
  const draft = draftResult.success ? draftResult.data : null;
  if (!text || text.length > 1000) return NextResponse.json({ error: "Escribi un mensaje valido." }, { status: 400 });
  const localPlan = simpleAssistantPlan(text, history);
  if (localPlan) return NextResponse.json({ plan: localPlan, draft: { action: localPlan.action === "reply" ? draft?.action ?? null : localPlan.action, data: localPlan.data }, requiresConfirmation: true, usedAI: false });
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
  const system = `You are the full-screen setup guide for a personal finance app used by a beginner. Return ONLY valid JSON with action, message and data. Allowed actions: ${actions.join(", ")}. Understand everyday Rioplatense Spanish, spelling mistakes, missing accents, commas, shorthand and incomplete sentences. The user must only chat and press Confirm; never tell them to fill a form or enter a technical value manually. Configure categories and budgets, accounts and balances, savings plans and goals, recurring salary income, credit cards, and recurring bills. Preserve every useful fact in Conversation draft and the conversation until confirmed or cancelled. If one essential fact is missing, use reply and ask exactly one short, natural-language question; never discard the existing facts. For an account whose name is known, default unspecified currency to UYU, type to CHECKING and balance to 0; state those defaults in the confirmation message. For a category, choose a suitable neutral color when none is given; do not ask for a color. For register_movement, a source-account phrase is a strict instruction: if the user says efectivo/cash, only select an account whose type is CASH; if they name an account, set account_id only to that exact ID from User context. Never fall back to a default account when a source account was mentioned. If that account does not exist, explain that you can create it and retain the movement details; do not propose the movement yet. If an account, card or category is not in User context, offer to create it while retaining the user's amount and currency. Do not invent IDs, names, amounts or dates. Use add_income_plan for a recurring salary. For recurring bills ask the next due date if absent. As soon as the requested action has the required information, return the action instead of more questions. Financial changes must be proposed, not executed. Always include every data field raw_text, account_id, category_id, name, institution, account_type, currency, amount, target_amount, date and color; use null when unused. Conversation draft: ${JSON.stringify(draft)}. User context: ${context}`;
  const limit = monthlyTokenLimit();
  let used = 0;
  try { used = await assistantTokensUsedThisMonth(session.user.id); } catch { return NextResponse.json({ error: "No se pudo verificar el uso de IA." }, { status: 503 }); }
  const estimated = Math.ceil((system.length + text.length) / 4) + 800;
  if (limit - used <= estimated) return NextResponse.json({ error: "Alcanzaste el limite mensual del asistente." }, { status: 429 });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "system", content: system }, ...history, { role: "user", content: text }], response_format: { type: "json_object" }, reasoning_effort: "minimal", max_completion_tokens: Math.min(900, limit - used - estimated) }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: typeof result?.error?.message === "string" ? `La IA no esta disponible: ${result.error.message}` : "La IA no esta disponible." }, { status: 502 });
    let normalized: { plan: AssistantPlan; intendedAction: (typeof actions)[number] | null } | null = null;
    try { normalized = normalizePlan(contentToJson(result?.choices?.[0]?.message?.content), draft); } catch { normalized = null; }
    const parsed = normalized?.plan;
    if (!parsed) return NextResponse.json({ error: "No pude continuar esa conversación. Intentá responder con el dato que te pedí." }, { status: 422 });
    const mentionedAccount = explicitAccountMention(text, (accounts.data ?? []) as AccountContext[]);
    if (parsed.action === "register_movement" && mentionedAccount.explicit) {
      if (!mentionedAccount.accountId) {
        normalized = {
          plan: {
            action: "reply",
            message: `No encuentro la cuenta ${mentionedAccount.name}. Puedo crearla y conservar este movimiento para registrarlo después.`,
            data: parsed.data,
          },
          intendedAction: "register_movement",
        };
      } else {
        normalized = { ...normalized!, plan: { ...parsed, data: { ...parsed.data, account_id: mentionedAccount.accountId } } };
      }
    }
    await logAssistantUsage(session.user.id, Number(result?.usage?.total_tokens ?? 0));
    const finalPlan = normalized!.plan;
    return NextResponse.json({ plan: finalPlan, draft: { action: normalized!.intendedAction ?? draft?.action ?? null, data: finalPlan.data }, requiresConfirmation: finalPlan.action !== "reply", remainingTokens: Math.max(0, limit - used - Number(result?.usage?.total_tokens ?? 0)), usedAI: true });
  } catch (error) {
    console.error("Assistant request failed", error);
    return NextResponse.json({ error: "No pude conectarme con la IA." }, { status: 502 });
  }
}
