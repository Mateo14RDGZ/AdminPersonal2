import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createTransactionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      amount: parsed.data.amount,
      merchant: parsed.data.merchant ?? null,
      note: parsed.data.note ?? null,
      category_id: parsed.data.category_id ?? null,
      source: "manual",
      occurred_at: parsed.data.occurred_at ?? new Date().toISOString(),
    })
    .select("*, categories(id, name, icon, color)")
    .single();

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

  return NextResponse.json({
    data: data ?? [],
    page,
    limit,
    total: count ?? 0,
  });
}
