"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

function authErrorMessage(message: string, mode: AuthMode) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "El correo o la contraseña son incorrectos.";
  }

  if (normalized.includes("user already registered")) {
    return "Ya existe una cuenta con este correo. Probá iniciar sesión.";
  }

  if (normalized.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (normalized.includes("email not confirmed")) {
    return "La cuenta todavía requiere confirmación de correo.";
  }

  if (normalized.includes("rate limit")) {
    return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
  }

  return mode === "sign-up"
    ? "No se pudo crear la cuenta. Revisá los datos e intentá nuevamente."
    : "No se pudo iniciar sesión. Revisá los datos e intentá nuevamente.";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/inicio");
        router.refresh();
        return;
      }

      setCheckingSession(false);
    });
  }, [router]);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Ingresá tu correo electrónico.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });

        if (signUpError) {
          setError(authErrorMessage(signUpError.message, mode));
          return;
        }

        if (!data.session) {
          setError(
            "Supabase todavía exige confirmar el correo. Desactivá esa opción e intentá nuevamente."
          );
          return;
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (signInError) {
          setError(authErrorMessage(signInError.message, mode));
          return;
        }
      }

      router.replace("/inicio");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo completar el acceso."
      );
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
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
          Registrá tus gastos en segundos. Tus datos quedan privados y
          sincronizados.
        </p>

        <div className="mt-7 grid grid-cols-2 rounded-2xl bg-black/5 p-1 dark:bg-white/10">
          <button
            type="button"
            onClick={() => changeMode("sign-in")}
            className={`rounded-xl px-3 py-2 text-sm font-medium ios-transition ${
              mode === "sign-in"
                ? "bg-white text-black shadow-sm dark:bg-black dark:text-white"
                : "text-[var(--color-muted)]"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => changeMode("sign-up")}
            className={`rounded-xl px-3 py-2 text-sm font-medium ios-transition ${
              mode === "sign-up"
                ? "bg-white text-black shadow-sm dark:bg-black dark:text-white"
                : "text-[var(--color-muted)]"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form
          onSubmit={(event) => void authenticate(event)}
          className="mt-4 space-y-3"
        >
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

          <label htmlFor="password" className="sr-only">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña (mínimo 6 caracteres)"
            className="w-full rounded-2xl border border-[var(--color-border)] bg-transparent px-4 py-3.5 text-base outline-none focus:border-[var(--color-accent)]"
          />

          <button
            type="submit"
            disabled={loading || checkingSession}
            className="w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-black ios-transition active:opacity-80 disabled:opacity-60"
          >
            {checkingSession
              ? "Comprobando sesión…"
              : loading
                ? mode === "sign-up"
                  ? "Creando cuenta…"
                  : "Ingresando…"
                : mode === "sign-up"
                  ? "Crear cuenta"
                  : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-4 text-xs text-[var(--color-muted)]">
          La sesión queda guardada en este dispositivo para que no tengas que
          iniciar sesión cada vez.
        </p>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
