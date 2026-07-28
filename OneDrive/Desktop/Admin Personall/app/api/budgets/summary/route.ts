import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { monthKey, monthRange } from "@/lib/format";
import { reconcileUserAccountBalances } from "@/lib/account-balance-reconciliation";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const month = request.nextUrl.searchParams.get("month") ?? monthKey();
  const { from, to } = monthRange(month);
  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const previousMonthDate = new Date(Date.UTC(year, monthNumber - 2, 1));
  const previousMonth = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const previousRange = monthRange(previousMonth);
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // The home summary must never wait for a screen reload to reflect a
  // transaction saved moments ago.
  try {
    await reconcileUserAccountBalances(createServiceClient(), user.id);
  } catch (reconciliationError) {
    return NextResponse.json({ error: reconciliationError instanceof Error ? reconciliationError.message : "No se pudieron actualizar los saldos." }, { status: 500 });
  }

  const supabase = await createClient();
  const [
    categoryResult,
    transactionResult,
    previousTransactionResult,
    financeResult,
    todayResult,
    accountResult,
    goalResult,
    pendingResult,
    recurringResult,
  ] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name"),
      supabase
        .from("transactions")
        .select("amount, category_id, type, currency, status")
        .eq("user_id", user.id)
        .gte("occurred_at", from)
        .lte("occurred_at", to),
      supabase
        .from("transactions")
        .select("amount, category_id, type, currency, status")
        .eq("user_id", user.id)
        .gte("occurred_at", previousRange.from)
        .lte("occurred_at", previousRange.to),
      supabase
        .from("financial_entries")
        .select("kind, amount, currency, is_recurring, occurred_at")
        .eq("user_id", user.id)
        .lte("occurred_at", monthEnd),
      supabase
        .from("transactions")
        .select("*, categories(id, name, icon, color)")
        .eq("user_id", user.id)
        .gte("occurred_at", todayStart.toISOString())
        .order("occurred_at", { ascending: false })
        .limit(20),
      supabase
        .from("accounts")
        .select("currency,current_balance,is_savings_account")
        .eq("user_id", user.id)
        .eq("is_archived", false),
      supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("pending_transaction_confirmations")
        .select("id,raw_input,created_at", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("recurring_transactions")
        .select("merchant,description,amount,currency,next_execution_date")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gte("next_execution_date", new Date().toISOString().slice(0, 10))
        .order("next_execution_date")
        .limit(1)
        .maybeSingle(),
    ]);

  const firstError =
    categoryResult.error ??
    transactionResult.error ??
    previousTransactionResult.error ??
    financeResult.error ??
    todayResult.error ??
    accountResult.error ??
    goalResult.error ??
    pendingResult.error ??
    recurringResult.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const transactions = transactionResult.data ?? [];
  const spentByCategory = new Map<string | null, number>();
  const previousSpentByCategory = new Map<string | null, number>();
  for (const transaction of transactions) {
    if (
      transaction.type !== "EXPENSE" ||
      transaction.currency !== "UYU" ||
      transaction.status !== "CONFIRMED"
    ) {
      continue;
    }
    const key = transaction.category_id;
    spentByCategory.set(
      key,
      (spentByCategory.get(key) ?? 0) + Number(transaction.amount)
    );
  }

  for (const transaction of previousTransactionResult.data ?? []) {
    if (transaction.type !== "EXPENSE" || transaction.currency !== "UYU" || transaction.status !== "CONFIRMED") continue;
    const key = transaction.category_id;
    previousSpentByCategory.set(key, (previousSpentByCategory.get(key) ?? 0) + Number(transaction.amount));
  }

  const totalSpent = transactions.reduce(
    (sum, transaction) =>
      transaction.type === "EXPENSE" &&
      transaction.currency === "UYU" &&
      transaction.status === "CONFIRMED"
        ? sum + Number(transaction.amount)
        : sum,
    0
  );

  const entriesThisMonth = (financeResult.data ?? []).filter(
    (entry) => entry.is_recurring || entry.occurred_at >= monthStart
  );
  const totalsByCurrency = new Map<
    string,
    { currency: string; income: number; savings: number; spent: number }
  >();
  const ensureCurrency = (currency: string) => {
    const existing = totalsByCurrency.get(currency);
    if (existing) return existing;
    const created = { currency, income: 0, savings: 0, spent: 0 };
    totalsByCurrency.set(currency, created);
    return created;
  };

  ensureCurrency("UYU");
  for (const entry of entriesThisMonth) {
    const totals = ensureCurrency(entry.currency || "UYU");
    if (entry.kind === "income") totals.income += Number(entry.amount);
    else totals.savings += Number(entry.amount);
  }
  for (const transaction of transactions) {
    if (transaction.status !== "CONFIRMED") continue;
    const totals = ensureCurrency(transaction.currency || "UYU");
    if (transaction.type === "INCOME" || transaction.type === "REFUND") {
      totals.income += Number(transaction.amount);
    } else if (transaction.type === "EXPENSE") {
      totals.spent += Number(transaction.amount);
    }
  }

  const availableByCurrency = (accountResult.data ?? []).reduce<Record<string, number>>(
    (totals, account) => {
      if (account.is_savings_account) return totals;
      const currency = account.currency || "UYU";
      totals[currency] = (totals[currency] ?? 0) + Number(account.current_balance);
      return totals;
    },
    {}
  );
  const savingsByCurrency = (accountResult.data ?? []).reduce<Record<string, number>>(
    (totals, account) => {
      if (!account.is_savings_account) return totals;
      const currency = account.currency || "UYU";
      totals[currency] = (totals[currency] ?? 0) + Number(account.current_balance);
      return totals;
    },
    {}
  );

  for (const currency of Object.keys(availableByCurrency)) ensureCurrency(currency);
  const balances = [...totalsByCurrency.values()]
    .map((totals) => ({ ...totals, available: availableByCurrency[totals.currency] ?? 0 }))
    .sort((first, second) => {
      const priority = ["UYU", "USD"];
      const firstIndex = priority.indexOf(first.currency);
      const secondIndex = priority.indexOf(second.currency);
      if (firstIndex !== -1 || secondIndex !== -1) {
        return (
          (firstIndex === -1 ? priority.length : firstIndex) -
          (secondIndex === -1 ? priority.length : secondIndex)
        );
      }
      return first.currency.localeCompare(second.currency);
    });
  const primaryTotals = balances.find(
    (totals) => totals.currency === "UYU"
  ) ?? {
    currency: "UYU",
    income: 0,
    savings: 0,
    spent: totalSpent,
    available: availableByCurrency.UYU ?? 0,
  };

  const byCategory = (categoryResult.data ?? []).map((category) => {
    const spent = spentByCategory.get(category.id) ?? 0;
    const budget =
      category.monthly_budget != null
        ? Number(category.monthly_budget)
        : null;

    return {
      category_id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      budget,
      spent,
      previousSpent: previousSpentByCategory.get(category.id) ?? 0,
      overBudget: budget != null && spent > budget,
    };
  });

  return NextResponse.json(
    {
      month,
      totalIncome: primaryTotals.income,
      fixedSavings: primaryTotals.savings,
      totalSpent,
      availableBudget: primaryTotals.available,
      balances,
      savingsAccountBalances: Object.entries(savingsByCurrency).map(([currency, balance]) => ({ currency, balance })),
      accountBalances: Object.values(
        (accountResult.data ?? []).reduce<
          Record<string, { currency: string; balance: number }>
        >((accumulator, account) => {
          if (account.is_savings_account) return accumulator;
          const currency = account.currency || "UYU";
          accumulator[currency] ??= { currency, balance: 0 };
          accumulator[currency].balance += Number(account.current_balance);
          return accumulator;
        }, {})
      ),
      pendingCount: pendingResult.count ?? 0,
      pendingConfirmations: pendingResult.data ?? [],
      primaryGoal: goalResult.data ?? null,
      nextPayment: recurringResult.data ?? null,
      uncategorized: spentByCategory.get(null) ?? 0,
      categories: byCategory,
      today: todayResult.data ?? [],
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
