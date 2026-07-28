import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { quickTransactionSchema } from "@/lib/validation";
import { databaseTransactionSource } from "@/lib/database-source";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;
  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("pending_transaction_confirmations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "PENDING")
    .gt("expires_at", new Date().toISOString())
    .single();
  if (dbError) {
    return NextResponse.json({ error: "Confirmación no disponible" }, { status: 404 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;
  const parsed = quickTransactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("pending_transaction_confirmations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "PENDING")
    .gt("expires_at", new Date().toISOString())
    .single();
  if (!pending) {
    return NextResponse.json({ error: "Confirmación no disponible" }, { status: 404 });
  }
  if (parsed.data.type === "TRANSFER" && !parsed.data.destination_account_id) {
    return NextResponse.json({ error: "ElegÃ­ la cuenta de destino para la transferencia." }, { status: 400 });
  }
  const service = createServiceClient();
  const accountIds = [parsed.data.account_id, parsed.data.destination_account_id].filter(
    (accountId): accountId is string => Boolean(accountId)
  );
  const { data: accounts, error: accountError } = await service
    .from("accounts")
    .select("id,currency")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .in("id", accountIds);
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if ((accounts ?? []).length !== accountIds.length || accounts?.some((account) => account.currency !== parsed.data.currency)) {
    return NextResponse.json({ error: "La cuenta elegida no estÃ¡ disponible o no coincide con la moneda." }, { status: 409 });
  }
  const { data, error: createError } = await service.rpc(
    "create_financial_transaction_service",
    {
      p_user_id: user.id,
      p_type: parsed.data.type,
      p_amount: parsed.data.amount,
      p_currency: parsed.data.currency,
      p_account_id: parsed.data.account_id,
      p_destination_account_id: parsed.data.destination_account_id ?? null,
      p_category_id: parsed.data.category_id ?? null,
      p_merchant: parsed.data.merchant ?? null,
      p_description: parsed.data.description ?? null,
      p_occurred_at: parsed.data.occurred_at ?? new Date().toISOString(),
      p_source: databaseTransactionSource(parsed.data.source),
      p_status: "CONFIRMED",
      p_idempotency_key: parsed.data.idempotency_key ?? null,
    }
  );
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 422 });
  }
  await supabase
    .from("pending_transaction_confirmations")
    .update({ status: "CONFIRMED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  return NextResponse.json({ success: true, transaction: data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;
  const supabase = await createClient();
  const { data, error: updateError } = await supabase
    .from("pending_transaction_confirmations")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Confirmacion no disponible" }, { status: 404 });
  return NextResponse.json({ success: true });
}
