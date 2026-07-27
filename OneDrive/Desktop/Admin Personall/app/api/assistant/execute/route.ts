import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["create_account", "update_account_balance", "delete_account", "add_savings_plan"]),
  data: z.object({
    account_id: z.string().uuid().nullable(),
    name: z.string().nullable(),
    institution: z.string().nullable(),
    account_type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    amount: z.number().finite().nullable(),
  }),
});

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  const { action, data } = parsed.data;
  const supabase = await createClient();

  if (action === "create_account") {
    if (!data.name || !data.account_type || !data.currency) return NextResponse.json({ error: "Faltan datos de la cuenta." }, { status: 400 });
    const { data: account, error: createError } = await supabase.from("accounts").insert({ user_id: user.id, name: data.name, institution: data.institution, type: data.account_type, currency: data.currency, initial_balance: data.amount ?? 0, current_balance: data.amount ?? 0, is_savings_account: data.account_type === "SAVINGS", is_default: false }).select("id,name").single();
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
    return NextResponse.json({ message: `Cuenta ${account.name} creada.`, account });
  }

  if (action === "update_account_balance") {
    if (!data.account_id || data.amount == null) return NextResponse.json({ error: "Falta la cuenta o el saldo." }, { status: 400 });
    const { data: account, error: updateError } = await supabase
      .from("accounts")
      .update({ current_balance: data.amount, updated_at: new Date().toISOString() })
      .eq("id", data.account_id)
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .select("id")
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!account) return NextResponse.json({ error: "Cuenta no disponible." }, { status: 404 });
    return NextResponse.json({ message: "Saldo de la cuenta actualizado." });
  }

  if (action === "delete_account") {
    if (!data.account_id) return NextResponse.json({ error: "Falta la cuenta." }, { status: 400 });
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id,currency,is_default")
      .eq("id", data.account_id)
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .maybeSingle();
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
    if (!account) return NextResponse.json({ error: "Cuenta no disponible." }, { status: 404 });

    const { error: deleteError } = await supabase
      .from("accounts")
      .update({ is_archived: true, is_default: false, updated_at: new Date().toISOString() })
      .eq("id", account.id)
      .eq("user_id", user.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    if (account.is_default) {
      const { data: replacement } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("currency", account.currency)
        .eq("is_archived", false)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (replacement) await supabase.from("accounts").update({ is_default: true }).eq("id", replacement.id);
    }
    return NextResponse.json({ message: "Cuenta eliminada del resumen." });
  }

  if (!data.name || !data.currency || !data.amount || data.amount <= 0) return NextResponse.json({ error: "Faltan datos del ahorro." }, { status: 400 });
  const { error: savingsError } = await supabase.from("financial_entries").insert({ user_id: user.id, kind: "saving", name: data.name, amount: data.amount, currency: data.currency, is_recurring: false, occurred_at: new Date().toISOString().slice(0, 10) });
  if (savingsError) return NextResponse.json({ error: savingsError.message }, { status: 500 });
  return NextResponse.json({ message: "Ahorro reservado agregado." });
}
