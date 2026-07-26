import { NextRequest, NextResponse } from "next/server";
import { authenticateAutomationToken } from "@/lib/automation-auth";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { quickTransactionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const parsed = quickTransactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ");
  const automation = bearer
    ? await authenticateAutomationToken(request)
    : null;
  let userId: string;
  let supabase;
  if (bearer) {
    if (!automation) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
    userId = automation.userId;
    supabase = automation.supabase;
  } else {
    const session = await requireUser();
    if (session.error) return session.error;
    userId = session.user.id;
    supabase = await createClient();
  }

  const args = {
    p_type: parsed.data.type,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_account_id: parsed.data.account_id,
    p_destination_account_id: parsed.data.destination_account_id ?? null,
    p_credit_card_id: parsed.data.credit_card_id ?? null,
    p_category_id: parsed.data.category_id ?? null,
    p_merchant: parsed.data.merchant ?? null,
    p_description: parsed.data.description ?? null,
    p_notes: parsed.data.notes ?? parsed.data.note ?? null,
    p_occurred_at: parsed.data.occurred_at ?? new Date().toISOString(),
    p_source: parsed.data.source,
    p_status: parsed.data.status,
    p_idempotency_key: parsed.data.idempotency_key ?? null,
  };
  const { data, error } = bearer
    ? await supabase.rpc("create_financial_transaction_service", {
        p_user_id: userId,
        p_type: args.p_type,
        p_amount: args.p_amount,
        p_currency: args.p_currency,
        p_account_id: args.p_account_id,
        p_destination_account_id: args.p_destination_account_id,
        p_category_id: args.p_category_id,
        p_merchant: args.p_merchant,
        p_description: args.p_description,
        p_occurred_at: args.p_occurred_at,
        p_source: args.p_source,
        p_status: args.p_status,
        p_idempotency_key: args.p_idempotency_key,
      })
    : await supabase.rpc("create_financial_transaction", args);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, transaction: data });
}

