import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const supabase = await createClient();
  let transactionsQuery = supabase
    .from("transactions")
    .select("id,type,amount,currency,merchant,description,notes,occurred_at,status,source,category_id,account_id,destination_account_id")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false });
  if (from) transactionsQuery = transactionsQuery.gte("occurred_at", from);
  if (to) transactionsQuery = transactionsQuery.lte("occurred_at", to);
  const [transactions, accounts, categories, goals] = await Promise.all([
    transactionsQuery,
    supabase.from("accounts").select("id,name,institution,type,currency,initial_balance,current_balance,is_savings_account,is_default,is_archived").eq("user_id", user.id),
    supabase.from("categories").select("id,name,icon,color,monthly_budget").eq("user_id", user.id),
    supabase.from("savings_goals").select("id,name,target_amount,current_amount,currency,target_date,is_primary,is_completed,is_archived").eq("user_id", user.id),
  ]);
  const firstError =
    transactions.error ?? accounts.error ?? categories.error ?? goals.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }
  return new NextResponse(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        transactions: transactions.data ?? [],
        accounts: accounts.data ?? [],
        categories: categories.data ?? [],
        goals: goals.data ?? [],
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="la-pesadilla-finanzas.json"',
        "Cache-Control": "private, no-store",
      },
    }
  );
}

