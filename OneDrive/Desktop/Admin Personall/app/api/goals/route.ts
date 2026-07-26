import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { savingsGoalSchema } from "@/lib/validation";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = savingsGoalSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await createClient();
  if (parsed.data.is_primary) {
    await supabase
      .from("savings_goals")
      .update({ is_primary: false })
      .eq("user_id", user.id);
  }
  const { data, error: dbError } = await supabase
    .from("savings_goals")
    .insert({ ...parsed.data, user_id: user.id })
    .select("*")
    .single();
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

