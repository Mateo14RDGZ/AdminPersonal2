"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
        },
      });

      if (signInError) {
        setError(
          signInError.message ||
            "No se pudo iniciar sesión con Apple. Verificá que el proveedor esté habilitado en Supabase."
        );
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo iniciar sesión con Apple."
      );
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
          className="mt-8 w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-black ios-transition active:opacity-80 disabled:opacity-60"
        >
          {loading ? "Abriendo Apple…" : "Continuar con Apple"}
        </button>
        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
