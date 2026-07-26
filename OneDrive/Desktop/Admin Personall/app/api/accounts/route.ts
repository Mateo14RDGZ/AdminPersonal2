import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { accountSchema } from "@/lib/validation";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  let accounts = data ?? [];
  if (accounts.length === 0) {
    const { data: created, error: createError } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name: "Cuenta principal",
        type: "OTHER",
        currency: "UYU",
        initial_balance: 0,
        current_balance: 0,
        is_default: true,
      })
      .select("*")
      .single();
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    accounts = created ? [created] : [];
  }
  return NextResponse.json(accounts, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await createClient();
  if (parsed.data.is_default) {
    await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("currency", parsed.data.currency);
  }
  const { data, error: dbError } = await supabase
    .from("accounts")
    .insert({
      ...parsed.data,
      user_id: user.id,
      current_balance: parsed.data.initial_balance,
    })
    .select("*")
    .single();
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
