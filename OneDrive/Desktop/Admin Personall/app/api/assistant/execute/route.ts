import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["create_account", "create_category", "update_account_balance", "delete_account", "add_savings_plan", "add_income_plan", "create_card", "create_goal", "create_recurring_payment", "set_category_budget"]),
  data: z.object({
    account_id: z.string().uuid().nullable(),
    category_id: z.string().uuid().nullable(),
    name: z.string().nullable(),
    institution: z.string().nullable(),
    account_type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    amount: z.number().finite().nullable(),
    target_amount: z.number().finite().nullable(),
    date: z.string().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  }),
});

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  const { action, data } = parsed.data;
  const supabase = await createClient();

  if (action === "create_category") {
    if (!data.name) return NextResponse.json({ error: "Falta el nombre de la categoria." }, { status: 400 });
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: data.name, icon: "tag", color: data.color ?? "#64748B" })
      .select("id,name")
      .single();
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });
    return NextResponse.json({ message: `Categoria ${category.name} creada.`, category });
  }

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

  if (action === "create_card") {
    if (!data.name || !data.currency || data.amount == null || data.amount < 0) return NextResponse.json({ error: "Faltan datos de la tarjeta." }, { status: 400 });
    const { data: card, error: cardError } = await supabase
      .from("credit_cards")
      .insert({ user_id: user.id, name: data.name, institution: data.institution, currency: data.currency, credit_limit: data.amount, current_used_amount: 0 })
      .select("id,name")
      .single();
    if (cardError) return NextResponse.json({ error: cardError.message }, { status: 500 });
    return NextResponse.json({ message: `Tarjeta ${card.name} creada.`, card });
  }

  if (action === "create_goal") {
    if (!data.name || !data.currency || !data.target_amount || data.target_amount <= 0) return NextResponse.json({ error: "Faltan datos de la meta." }, { status: 400 });
    const { data: goal, error: goalError } = await supabase
      .from("savings_goals")
      .insert({ user_id: user.id, name: data.name, currency: data.currency, target_amount: data.target_amount, current_amount: Math.max(0, data.amount ?? 0), target_date: data.date || null, is_primary: false })
      .select("id,name")
      .single();
    if (goalError) return NextResponse.json({ error: goalError.message }, { status: 500 });
    return NextResponse.json({ message: `Meta ${goal.name} creada.`, goal });
  }

  if (action === "create_recurring_payment") {
    if (!data.name || !data.currency || !data.amount || data.amount <= 0 || !data.date || !data.account_id) return NextResponse.json({ error: "ElegÃ­ la cuenta que se debe modificar para este pago recurrente." }, { status: 400 });
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", data.account_id)
      .eq("user_id", user.id)
      .eq("currency", data.currency)
      .eq("is_archived", false)
      .maybeSingle();
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
    if (!account) return NextResponse.json({ error: "La cuenta no estÃ¡ disponible o no usa la misma moneda." }, { status: 409 });
    const { error: recurringError } = await supabase.from("recurring_transactions").insert({
      user_id: user.id, type: "EXPENSE", merchant: data.name, amount: data.amount, currency: data.currency,
      account_id: data.account_id, frequency: "MONTHLY", next_execution_date: data.date, auto_create: false,
    });
    if (recurringError) return NextResponse.json({ error: recurringError.message }, { status: 500 });
    return NextResponse.json({ message: "Pago mensual programado." });
  }

  if (action === "set_category_budget") {
    if (!data.category_id || data.amount == null || data.amount < 0) return NextResponse.json({ error: "Falta la categoría o el monto." }, { status: 400 });
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .update({ monthly_budget: data.amount })
      .eq("id", data.category_id)
      .eq("user_id", user.id)
      .select("name")
      .maybeSingle();
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });
    if (!category) return NextResponse.json({ error: "Categoría no disponible." }, { status: 404 });
    return NextResponse.json({ message: `Presupuesto de ${category.name} actualizado.` });
  }

  if (!data.name || !data.currency || !data.amount || data.amount <= 0) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  const kind = action === "add_income_plan" ? "income" : "saving";
  const { error: entryError } = await supabase.from("financial_entries").insert({ user_id: user.id, kind, name: data.name, amount: data.amount, currency: data.currency, is_recurring: action === "add_income_plan", occurred_at: new Date().toISOString().slice(0, 10) });
  if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 });
  return NextResponse.json({ message: action === "add_income_plan" ? "Ingreso recurrente configurado." : "Ahorro reservado agregado." });
}
