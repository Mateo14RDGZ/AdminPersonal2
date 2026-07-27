import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { assistantTokensUsedThisMonth, logAssistantUsage, monthlyTokenLimit } from "@/lib/assistant-usage";
import { simpleAssistantPlan } from "@/lib/simple-assistant";

const planSchema = z.object({
  action: z.enum(["reply", "register_movement", "create_account", "update_account_balance", "delete_account", "add_savings_plan", "create_card", "create_goal", "create_recurring_payment", "set_category_budget"]),
  message: z.string().min(1).max(500),
  data: z.object({
    raw_text: z.string().nullable(), account_id: z.string().uuid().nullable(), category_id: z.string().uuid().nullable(), name: z.string().nullable(), institution: z.string().nullable(),
    account_type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    amount: z.number().finite().nullable(), target_amount: z.number().finite().nullable(), date: z.string().nullable(),
  }),
});

export type AssistantPlan = z.infer<typeof planSchema>;

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "La IA todavía no está configurada." }, { status: 503 });
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 1000) return NextResponse.json({ error: "Escribí un mensaje válido." }, { status: 400 });

  const simplePlan = simpleAssistantPlan(text);
  if (simplePlan) {
    return NextResponse.json({ plan: simplePlan, requiresConfirmation: true, usedAI: false });
  }

  const supabase = await createClient();
  const [accountsResult, categoriesResult, cardsResult, goalsResult, recurringResult] = await Promise.all([
    supabase.from("accounts").select("id,name,institution,type,currency,current_balance").eq("user_id", user.id).eq("is_archived", false),
    supabase.from("categories").select("id,name,monthly_budget").eq("user_id", user.id),
    supabase.from("credit_cards").select("id,name,institution,currency,credit_limit,current_used_amount").eq("user_id", user.id).eq("is_archived", false),
    supabase.from("savings_goals").select("id,name,currency,target_amount,current_amount").eq("user_id", user.id).eq("is_archived", false),
    supabase.from("recurring_transactions").select("id,merchant,amount,currency,frequency,next_execution_date").eq("user_id", user.id).eq("is_active", true),
  ]);
  const context = JSON.stringify({ accounts: accountsResult.data ?? [], categories: categoriesResult.data ?? [], cards: cardsResult.data ?? [], goals: goalsResult.data ?? [], recurring: recurringResult.data ?? [] });
  const system = `Sos el asistente de una app personal de finanzas en Uruguay. Respondé siempre en español y devolvé únicamente JSON válido. Podés proponer: register_movement, create_account, update_account_balance, delete_account, add_savings_plan, create_card, create_goal, create_recurring_payment, set_category_budget o reply. Nunca inventes cuentas, tarjetas, metas, categorías ni IDs. Para mover dinero o registrar movimientos usá register_movement con raw_text igual a la frase original. Para “tengo más ahorro” preguntá qué cuenta de ahorro usar si no se nombra una. Usá create_card para crear una tarjeta, create_goal para una meta, create_recurring_payment para un pago periódico y set_category_budget para un presupuesto de categoría existente; en ese último caso usá category_id. Toda acción financiera debe ser una propuesta; si falta un dato, usá reply y hacé una pregunta breve. Contexto del usuario: ${context}. El JSON debe tener action, message y data con raw_text, account_id, category_id, name, institution, account_type, currency, amount, target_amount y date; los no usados deben ser null.`;
  const limit = monthlyTokenLimit();
  let used: number;
  try {
    used = await assistantTokensUsedThisMonth(user.id);
  } catch {
    return NextResponse.json({ error: "El control de uso de IA no está disponible. Probá nuevamente en unos instantes." }, { status: 503 });
  }
  const estimatedInput = Math.ceil((system.length + text.length) / 4) + 500;
  const remaining = limit - used;
  if (remaining <= estimatedInput) return NextResponse.json({ error: `Alcanzaste el límite mensual del asistente (${limit.toLocaleString("es-UY")} tokens).` }, { status: 429 });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "system", content: system }, { role: "user", content: text }], response_format: { type: "json_object" }, max_completion_tokens: Math.min(500, remaining - estimatedInput) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const providerMessage = typeof result?.error?.message === "string" ? result.error.message : null;
      const providerCode = typeof result?.error?.code === "string" ? result.error.code : `HTTP ${response.status}`;
      console.error("OpenAI assistant request failed", { status: response.status, code: providerCode, message: providerMessage });
      return NextResponse.json({ error: providerMessage ? `La IA no está disponible: ${providerMessage}` : `La IA no está disponible (${providerCode}).` }, { status: 502 });
    }
    const rawContent = result?.choices?.[0]?.message?.content;
    const content = (Array.isArray(rawContent)
      ? rawContent.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("")
      : typeof rawContent === "string" ? rawContent : "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    let candidate: unknown = null;
    try { candidate = typeof content === "string" ? JSON.parse(content) : null; } catch { return NextResponse.json({ error: "La IA devolvió una respuesta inválida." }, { status: 422 }); }
    const plan = planSchema.safeParse(candidate);
    if (!plan.success) return NextResponse.json({ error: "No pude interpretar la respuesta de la IA." }, { status: 422 });
    try {
      await logAssistantUsage(user.id, Number(result?.usage?.total_tokens ?? 0));
    } catch {
      return NextResponse.json({ error: "No pude registrar el uso de IA de forma segura." }, { status: 503 });
    }
    return NextResponse.json({ plan: plan.data, requiresConfirmation: plan.data.action !== "reply", remainingTokens: Math.max(0, remaining - Number(result?.usage?.total_tokens ?? 0)) });
  } catch {
    return NextResponse.json({ error: "No pude conectarme con la IA." }, { status: 502 });
  }
}
