import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { patchTransactionSchema } from "@/lib/validation";

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
  const { error: dbError } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
