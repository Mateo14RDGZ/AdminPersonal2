import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { PageTransition } from "@/components/page-transition";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="screen-height safe-top mx-auto flex w-full max-w-[430px] flex-col pb-24">
      <main className="flex-1 px-3.5 pt-3 min-[390px]:px-5 min-[390px]:pt-4">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
    </div>
  );
}
