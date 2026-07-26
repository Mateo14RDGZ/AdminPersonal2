import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { monthKey, monthRange } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const month = request.nextUrl.searchParams.get("month") ?? monthKey();
  const { from, to } = monthRange(month);
  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const supabase = await createClient();
  const [categoryResult, transactionResult, financeResult, todayResult] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name"),
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("user_id", user.id)
        .gte("occurred_at", from)
        .lte("occurred_at", to),
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
    ]);

  const firstError =
    categoryResult.error ??
    transactionResult.error ??
    financeResult.error ??
    todayResult.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const transactions = transactionResult.data ?? [];
  const spentByCategory = new Map<string | null, number>();
  for (const transaction of transactions) {
    const key = transaction.category_id;
    spentByCategory.set(
      key,
      (spentByCategory.get(key) ?? 0) + Number(transaction.amount)
    );
  }

  const totalSpent = transactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount),
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

  ensureCurrency("UYU").spent = totalSpent;
  for (const entry of entriesThisMonth) {
    const totals = ensureCurrency(entry.currency || "UYU");
    if (entry.kind === "income") totals.income += Number(entry.amount);
    else totals.savings += Number(entry.amount);
  }

  const balances = [...totalsByCurrency.values()]
    .map((totals) => ({
      ...totals,
      available: totals.income - totals.savings - totals.spent,
    }))
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
    available: -totalSpent,
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
