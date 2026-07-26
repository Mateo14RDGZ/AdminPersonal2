"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Ingresá tu correo electrónico.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
          shouldCreateUser: true,
        },
      });

      if (signInError) {
        setError(signInError.message || "No se pudo enviar el enlace de acceso.");
        return;
      }

      setSent(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo enviar el enlace de acceso."
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

        {sent ? (
          <div className="mt-8">
            <p className="text-base font-semibold">Revisá tu correo</p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Te enviamos un enlace de acceso a <strong>{email.trim()}</strong>.
              Abrilo en este dispositivo para entrar.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setError(null);
              }}
              className="mt-5 text-sm font-medium text-[var(--color-accent)]"
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void signIn(event)} className="mt-8 space-y-3">
            <label htmlFor="email" className="sr-only">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-2xl border border-[var(--color-border)] bg-transparent px-4 py-3.5 text-base outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-black ios-transition active:opacity-80 disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Enviar enlace de acceso"}
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
