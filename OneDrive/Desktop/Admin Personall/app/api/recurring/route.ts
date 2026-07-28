import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { recurringTransactionSchema, recurringTransactionUpdateSchema } from "@/lib/validation";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("next_execution_date");
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = recurringTransactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", parsed.data.account_id)
    .eq("user_id", user.id)
    .eq("currency", parsed.data.currency)
    .eq("is_archived", false)
    .maybeSingle();
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: "ElegÃ­ una cuenta activa con la misma moneda para este pago." }, { status: 409 });
  const { data, error: dbError } = await supabase
    .from("recurring_transactions")
    .insert({
      ...parsed.data,
      user_id: user.id,
      start_date:
        parsed.data.start_date ?? new Date().toISOString().slice(0, 10),
    })
    .select("*")
    .single();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = recurringTransactionUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createClient();
  const { id, ...changes } = parsed.data;
  const { data: existing, error: existingError } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "No encontramos ese próximo pago." }, { status: 404 });

  const next = recurringTransactionSchema.safeParse({ ...existing, ...changes });
  if (!next.success) return NextResponse.json({ error: next.error.flatten() }, { status: 400 });
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", next.data.account_id)
    .eq("user_id", user.id)
    .eq("currency", next.data.currency)
    .eq("is_archived", false)
    .maybeSingle();
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: "Elegí una cuenta activa con la misma moneda para este pago." }, { status: 409 });

  const { data, error: updateError } = await supabase
    .from("recurring_transactions")
    .update(next.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
