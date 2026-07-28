import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { accountSchema, accountUpdateSchema } from "@/lib/validation";
import { reconcileUserAccountBalances } from "@/lib/account-balance-reconciliation";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const supabase = await createClient();
  try {
    await reconcileUserAccountBalances(createServiceClient(), user.id);
  } catch (reconciliationError) {
    return NextResponse.json({ error: reconciliationError instanceof Error ? reconciliationError.message : "No se pudieron actualizar los saldos." }, { status: 500 });
  }
  const { data, error: dbError } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  let accounts = data ?? [];
  if (accounts.length === 0) {
    const { data: created, error: createError } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name: "Cuenta principal",
        type: "OTHER",
        currency: "UYU",
        initial_balance: 0,
        current_balance: 0,
        is_default: true,
      })
      .select("*")
      .single();
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    accounts = created ? [created] : [];
  }
  return NextResponse.json(accounts, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await createClient();
  if (parsed.data.is_default) {
    await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("currency", parsed.data.currency);
  }
  const { data, error: dbError } = await supabase
    .from("accounts")
    .insert({
      ...parsed.data,
      user_id: user.id,
      current_balance: parsed.data.initial_balance,
    })
    .select("*")
    .single();
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta la cuenta" }, { status: 400 });
  const parsed = accountUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("accounts")
    .select("id,currency")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .single();
  if (currentError || !current) {
    return NextResponse.json({ error: "Cuenta no disponible" }, { status: 404 });
  }
  if (parsed.data.is_default) {
    await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("currency", current.currency);
  }
  const { data, error: updateError } = await supabase
    .from("accounts")
    .update({
      ...parsed.data,
      is_savings_account: parsed.data.type === "SAVINGS",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta la cuenta" }, { status: 400 });

  const supabase = await createClient();
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id,currency,is_default")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .single();
  if (accountError || !account) {
    return NextResponse.json({ error: "Cuenta no disponible" }, { status: 404 });
  }

  // Archiving removes the balance from all live summaries while keeping the
  // associated history intact and therefore avoids destructive data loss.
  const { error: archiveError } = await supabase
    .from("accounts")
    .update({ is_archived: true, is_default: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 });

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
    if (replacement) {
      await supabase.from("accounts").update({ is_default: true }).eq("id", replacement.id);
    }
  }

  return NextResponse.json({ ok: true });
}
