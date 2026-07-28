import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { patchTransactionSchema } from "@/lib/validation";
import { reconcileUserAccountBalances } from "@/lib/account-balance-reconciliation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = patchTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // Editing balances, amounts or accounts requires a compensating balance
  // adjustment. The current app only supports safe recategorization here.
  const unsafeFields = Object.keys(parsed.data).filter((key) => key !== "category_id");
  if (unsafeFields.length) {
    return NextResponse.json(
      { error: "Solo se puede cambiar la categorÃ­a desde el historial." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("transactions")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, categories(id, name, icon, color)")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id,type,amount,status,account_id,destination_account_id,credit_card_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (transactionError || !transaction) {
    return NextResponse.json(
      { error: transactionError?.message ?? "Movimiento no encontrado" },
      { status: transactionError ? 500 : 404 }
    );
  }

  // The original SQL function also writes an audit row, but older projects
  // intentionally deny browser-session inserts into audit_logs. Reverse the
  // balance here with the authenticated user session, then remove the entry.
  if (transaction.status === "CONFIRMED") {
    const accountIds = [transaction.account_id, transaction.destination_account_id].filter(
      (accountId): accountId is string => Boolean(accountId)
    );
    if (accountIds.length) {
      const { data: accounts, error: accountError } = await supabase
        .from("accounts")
        .select("id,current_balance")
        .eq("user_id", user.id)
        .in("id", accountIds);
      if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });

      const changes = new Map<string, number>();
      const amount = Number(transaction.amount);
      const add = (accountId: string | null, delta: number) => {
        if (accountId) changes.set(accountId, (changes.get(accountId) ?? 0) + delta);
      };
      if (["EXPENSE", "LOAN_GIVEN", "CREDIT_CARD_PAYMENT"].includes(transaction.type)) {
        add(transaction.account_id, amount);
      } else if (["INCOME", "REFUND", "LOAN_RECEIVED"].includes(transaction.type)) {
        add(transaction.account_id, -amount);
      } else if (transaction.type === "TRANSFER") {
        add(transaction.account_id, amount);
        add(transaction.destination_account_id, -amount);
      }

      for (const account of accounts ?? []) {
        const delta = changes.get(account.id) ?? 0;
        if (!delta) continue;
        const { error: updateError } = await supabase
          .from("accounts")
          .update({ current_balance: Number(account.current_balance) + delta, updated_at: new Date().toISOString() })
          .eq("id", account.id)
          .eq("user_id", user.id);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  // Reconcile from remaining confirmed history. This is especially important
  // for legacy databases where a prior insert/delete function did not keep
  // `current_balance` in sync, and covers both ends of a transfer.
  try {
    await reconcileUserAccountBalances(createServiceClient(), user.id);
  } catch (reconciliationError) {
    return NextResponse.json({ error: reconciliationError instanceof Error ? reconciliationError.message : "El movimiento se eliminó, pero no se pudo actualizar el saldo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
