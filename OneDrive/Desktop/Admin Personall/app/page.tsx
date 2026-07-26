import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? "/inicio" : "/login");
}
