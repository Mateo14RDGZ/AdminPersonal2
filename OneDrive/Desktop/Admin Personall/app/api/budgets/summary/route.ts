import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { monthKey, monthRange } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const month =
    request.nextUrl.searchParams.get("month") ?? monthKey();
  const { from, to } = monthRange(month);

  const supabase = await createClient();

  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (catError) {
    return NextResponse.json({ error: catError.message }, { status: 500 });
  }

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("amount, category_id")
    .eq("user_id", user.id)
    .gte("occurred_at", from)
    .lte("occurred_at", to);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const spentByCategory = new Map<string | null, number>();
  for (const tx of transactions ?? []) {
    const key = tx.category_id;
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Number(tx.amount));
  }

  const totalSpent = (transactions ?? []).reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );

  const byCategory = (categories ?? []).map((cat) => {
    const spent = spentByCategory.get(cat.id) ?? 0;
    const budget = cat.monthly_budget != null ? Number(cat.monthly_budget) : null;
    return {
      category_id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      budget,
      spent,
      overBudget: budget != null && spent > budget,
    };
  });

  const uncategorized = spentByCategory.get(null) ?? 0;

  return NextResponse.json({
    month,
    totalSpent,
    uncategorized,
    categories: byCategory,
  });
}
