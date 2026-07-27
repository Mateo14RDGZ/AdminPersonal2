import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

const planSchema = z.object({
  action: z.enum(["reply", "register_movement", "create_account", "update_account_balance", "delete_account", "add_savings_plan"]),
  message: z.string().min(1).max(500),
  data: z.object({
    raw_text: z.string().nullable(),
    account_id: z.string().uuid().nullable(),
    name: z.string().nullable(),
    institution: z.string().nullable(),
    account_type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    amount: z.number().finite().nullable(),
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

  const supabase = await createClient();
  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from("accounts").select("id,name,institution,type,currency,current_balance").eq("user_id", user.id).eq("is_archived", false),
    supabase.from("categories").select("name").eq("user_id", user.id),
  ]);
  const context = JSON.stringify({ accounts: accounts ?? [], categories: categories?.map((item) => item.name) ?? [] });
  const system = `Sos el asistente de una app personal de finanzas en Uruguay. Respondé siempre en español y devolvé únicamente JSON válido. Podés proponer: register_movement, create_account, update_account_balance, delete_account, add_savings_plan o reply. Nunca inventes cuentas ni IDs. Para mover dinero o registrar movimientos usá register_movement con raw_text igual a la frase original. Para “tengo más ahorro” preguntá qué cuenta de ahorro usar si no se nombra una. Toda acción financiera debe ser una propuesta; si falta un dato, usá reply y hacé una pregunta breve. Contexto del usuario: ${context}. El JSON debe tener action, message y data con raw_text, account_id, name, institution, account_type, currency y amount; los no usados deben ser null.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "system", content: system }, { role: "user", content: text }], response_format: { type: "json_object" } }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: "No pude consultar la IA en este momento." }, { status: 502 });
    const content = result?.choices?.[0]?.message?.content;
    let candidate: unknown = null;
    try {
      candidate = typeof content === "string" ? JSON.parse(content) : null;
    } catch {
      return NextResponse.json({ error: "La IA devolvió una respuesta inválida." }, { status: 422 });
    }
    const plan = planSchema.safeParse(candidate);
    if (!plan.success) return NextResponse.json({ error: "No pude interpretar la respuesta de la IA." }, { status: 422 });
    return NextResponse.json({ plan: plan.data, requiresConfirmation: plan.data.action !== "reply" });
  } catch {
    return NextResponse.json({ error: "No pude conectarme con la IA." }, { status: 502 });
  }
}
