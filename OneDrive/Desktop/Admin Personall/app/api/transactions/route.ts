import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createTransactionSchema } from "@/lib/validation";
import { databaseTransactionSource } from "@/lib/database-source";

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  let accountId = parsed.data.account_id;
  if (!accountId) {
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("currency", parsed.data.currency)
      .eq("is_archived", false)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    accountId = account?.id ?? null;
  }

  if (!accountId) {
    return NextResponse.json(
      { error: "Creá una cuenta para esa moneda antes de registrar el movimiento." },
      { status: 409 }
    );
  }

  const { data, error: dbError } = await supabase.rpc(
    "create_financial_transaction",
    {
      p_type: parsed.data.type,
      p_amount: parsed.data.amount,
      p_currency: parsed.data.currency,
      p_account_id: accountId,
      p_destination_account_id: parsed.data.destination_account_id ?? null,
      p_credit_card_id: parsed.data.credit_card_id ?? null,
      p_category_id: parsed.data.category_id ?? null,
      p_merchant: parsed.data.merchant ?? null,
      p_description: parsed.data.description ?? null,
      p_notes: parsed.data.notes ?? parsed.data.note ?? null,
      p_occurred_at: parsed.data.occurred_at ?? new Date().toISOString(),
      p_source: databaseTransactionSource(parsed.data.source),
      p_status: parsed.data.status,
      p_idempotency_key: parsed.data.idempotency_key ?? null,
    }
  );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*, categories(id, name, icon, color)", { count: "exact" })
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) query = query.gte("occurred_at", from);
  if (to) query = query.lte("occurred_at", to);
  if (category) query = query.eq("category_id", category);
  if (q?.trim()) query = query.ilike("merchant", `%${q.trim()}%`);

  const { data, error: dbError, count } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: data ?? [],
      page,
      limit,
      total: count ?? 0,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
