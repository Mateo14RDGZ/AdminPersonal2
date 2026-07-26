import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null as null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, error: null as null };
}
