"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
      },
    });
  };

  return (
    <div className="screen-height safe-top safe-bottom flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[20px] bg-[var(--color-surface-elevated)] p-8 text-center">
        <p
          className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold text-white"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          $
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Registrá tus gastos en segundos. Privado, rápido y pensado para iPhone.
        </p>
        <button
          type="button"
          onClick={() => void signIn()}
          className="mt-8 w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-black ios-transition active:opacity-80"
        >
          Continuar con Apple
        </button>
      </div>
    </div>
  );
}
