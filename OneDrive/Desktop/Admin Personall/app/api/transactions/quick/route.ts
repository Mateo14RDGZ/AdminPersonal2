import { NextRequest, NextResponse } from "next/server";
import { authenticateAutomationToken } from "@/lib/automation-auth";
import { requireUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { quickTransactionSchema } from "@/lib/validation";
import { databaseTransactionSource } from "@/lib/database-source";

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
  if (bearer) {
    if (!automation) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
    userId = automation.userId;
  } else {
    const session = await requireUser();
    if (session.error) return session.error;
    userId = session.user.id;
  }

  const args = {
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
    p_status: parsed.data.status,
    p_idempotency_key: parsed.data.idempotency_key ?? null,
  };
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
    .eq("user_id", userId)
    .eq("is_archived", false)
    .in("id", accountIds);
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  if ((accounts ?? []).length !== accountIds.length || accounts?.some((account) => account.currency !== parsed.data.currency)) {
    return NextResponse.json({ error: "La cuenta elegida no estÃ¡ disponible o no coincide con la moneda." }, { status: 409 });
  }
  const { data, error } = await service.rpc("create_financial_transaction_service", {
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
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, transaction: data });
}
