import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import {
  createAutomationToken,
  hashAutomationToken,
} from "@/lib/automation-auth";
import { createServiceClient } from "@/lib/supabase/service";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Atajo de iPhone"),
});

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  const supabase = createServiceClient();
  const { data, error: dbError } = await supabase
    .from("automation_tokens")
    .select("id,name,token_prefix,last_used_at,expires_at,is_active,created_at")
    .eq("user_id", user.id)
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
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const token = createAutomationToken();
  const supabase = createServiceClient();
  const { data, error: dbError } = await supabase
    .from("automation_tokens")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      token_hash: hashAutomationToken(token),
      token_prefix: token.slice(0, 12),
    })
    .select("id,name,token_prefix,last_used_at,expires_at,is_active,created_at")
    .single();
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ...data, token }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("automation_tokens")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

