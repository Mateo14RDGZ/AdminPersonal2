import type { SupabaseClient } from "@supabase/supabase-js";

type AccountRow = { id: string; initial_balance: number | string; current_balance: number | string };
type TransactionRow = { type: string; amount: number | string; account_id: string | null; destination_account_id: string | null; status: string };
type SavedTransaction = { id?: string | null; type: string; amount: number | string; status: string; account_id: string | null; destination_account_id: string | null };

/**
 * Makes account balances a deterministic projection of confirmed history.
 * It also repairs projects where an older database function inserted the
 * movement but did not update `accounts.current_balance`.
 */
export async function reconcileUserAccountBalances(supabase: SupabaseClient, userId: string) {
  const [{ data: accounts, error: accountsError }, { data: transactions, error: transactionsError }] = await Promise.all([
    supabase.from("accounts").select("id,initial_balance,current_balance").eq("user_id", userId).eq("is_archived", false),
    supabase.from("transactions").select("type,amount,account_id,destination_account_id,status").eq("user_id", userId).eq("status", "CONFIRMED"),
  ]);
  if (accountsError) throw new Error(accountsError.message);
  if (transactionsError) throw new Error(transactionsError.message);

  const balanceByAccount = new Map(
    ((accounts ?? []) as AccountRow[]).map((account) => [account.id, Number(account.initial_balance) || 0])
  );
  const add = (accountId: string | null, delta: number) => {
    if (!accountId || !balanceByAccount.has(accountId)) return;
    balanceByAccount.set(accountId, (balanceByAccount.get(accountId) ?? 0) + delta);
  };

  for (const transaction of (transactions ?? []) as TransactionRow[]) {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (["EXPENSE", "LOAN_GIVEN", "CREDIT_CARD_PAYMENT"].includes(transaction.type)) add(transaction.account_id, -amount);
    else if (["INCOME", "REFUND", "LOAN_RECEIVED"].includes(transaction.type)) add(transaction.account_id, amount);
    else if (transaction.type === "TRANSFER") {
      add(transaction.account_id, -amount);
      add(transaction.destination_account_id, amount);
    }
  }

  const updates = ((accounts ?? []) as AccountRow[]).flatMap((account) => {
    const expected = Math.round((balanceByAccount.get(account.id) ?? 0) * 100) / 100;
    return Math.abs((Number(account.current_balance) || 0) - expected) < 0.005
      ? []
      : [supabase.from("accounts").update({ current_balance: expected, updated_at: new Date().toISOString() }).eq("id", account.id).eq("user_id", userId)];
  });
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
  return balanceByAccount;
}

/** Fails closed: only report success when the account link and balance are real. */
export async function verifySavedTransactionAccount(
  supabase: SupabaseClient,
  userId: string,
  transaction: SavedTransaction,
  expectedAccountId: string
) {
  if (!transaction.id || transaction.status !== "CONFIRMED" || transaction.account_id !== expectedAccountId) {
    throw new Error("El movimiento no quedó asociado a la cuenta elegida.");
  }
  const expectedBalances = await reconcileUserAccountBalances(supabase, userId);
  const accountIds = [transaction.account_id, transaction.destination_account_id].filter((id): id is string => Boolean(id));
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id,current_balance")
    .eq("user_id", userId)
    .in("id", accountIds);
  if (error) throw new Error(error.message);
  if ((accounts ?? []).length !== accountIds.length) throw new Error("La cuenta elegida ya no está disponible.");
  for (const account of accounts ?? []) {
    const expected = Math.round((expectedBalances.get(account.id) ?? Number.NaN) * 100) / 100;
    if (!Number.isFinite(expected) || Math.abs(Number(account.current_balance) - expected) >= 0.005) {
      throw new Error("No se pudo aplicar el movimiento al saldo de la cuenta.");
    }
  }
}
