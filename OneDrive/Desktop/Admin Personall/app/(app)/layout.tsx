import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="screen-height safe-top mx-auto flex max-w-lg flex-col pb-24">
      <main className="flex-1 px-4 pt-4 ios-transition">{children}</main>
      <BottomNav />
    </div>
  );
}
