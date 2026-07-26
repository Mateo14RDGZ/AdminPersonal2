"use client";

import { useCallback, useEffect, useState } from "react";
import { IconBrandApple, IconCopy, IconKey, IconTrash } from "@tabler/icons-react";
import {
  buildIosShortcutPrompt,
  PARSE_TRANSACTION_ENDPOINT,
  shortcutRequestJson,
} from "@/lib/shortcut-prompt";

type TokenInfo = {
  id: string;
  name: string;
  token_prefix: string | null;
  last_used_at: string | null;
  is_active: boolean;
};

export function AutomationSection() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [revealed, setRevealed] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/automations/tokens", { cache: "no-store" });
    if (response.ok) setTokens(await response.json());
  }, []);
  useEffect(() => void load(), [load]);

  const createToken = async () => {
    const response = await fetch("/api/automations/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Atajo de iPhone" }),
    });
    if (!response.ok) {
      setMessage("No se pudo generar el token.");
      return;
    }
    const data = await response.json();
    setRevealed(data.token);
    setMessage("Copialo ahora: por seguridad no volverá a mostrarse.");
    await load();
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copiado.`);
  };

  const revoke = async (id: string) => {
    await fetch(`/api/automations/tokens?id=${id}`, { method: "DELETE" });
    await load();
  };

  const endpoint = PARSE_TRANSACTION_ENDPOINT;
  const authorization = revealed ? `Bearer ${revealed}` : "";
  const requestJson = shortcutRequestJson();

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-label">Siri y automatizaciones</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Registrá gastos por voz con Apple Shortcuts
        </p>
      </div>
      <div className="app-card space-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
            <IconBrandApple size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Atajo “Anotá un gasto”</p>
            <p className="text-xs text-[var(--color-muted)]">
              Token individual, revocable y sin usar tu contraseña
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void createToken()}
          className="pressable min-h-12 w-full rounded-2xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-white"
        >
          Generar token
        </button>
        <button
          type="button"
          onClick={() => void copy(endpoint, "Endpoint")}
          className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] text-sm font-medium"
        >
          <IconCopy size={18} /> Copiar endpoint
        </button>
        <button
          type="button"
          onClick={() => void copy(requestJson, "JSON")}
          className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] text-sm font-medium"
        >
          <IconCopy size={18} /> Copiar JSON
        </button>
      </div>

      {revealed ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            TOKEN — SE MUESTRA UNA SOLA VEZ
          </p>
          <code className="mt-2 block break-all text-xs">{revealed}</code>
          <button
            type="button"
            onClick={() => void copy(revealed, "Token")}
            className="pressable mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-semibold text-black"
          >
            <IconCopy size={17} /> Copiar token
          </button>
          <button
            type="button"
            onClick={() => void copy(authorization, "Header Authorization")}
            className="pressable mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 text-sm font-semibold"
          >
            <IconCopy size={17} /> Copiar Authorization completo
          </button>
          <button
            type="button"
            onClick={() => void copy(buildIosShortcutPrompt(revealed), "Prompt para Atajos")}
            className="pressable mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-sm font-semibold text-white"
          >
            <IconCopy size={17} /> Copiar prompt para crear el Atajo
          </button>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            El prompt incluye este token solo mientras se muestra en pantalla. No se guarda en el dispositivo ni en el repositorio.
          </p>
        </div>
      ) : null}

      {tokens.filter((token) => token.is_active).map((token) => (
        <div key={token.id} className="app-card flex items-center gap-3 px-4 py-3">
          <IconKey className="text-[var(--color-accent)]" size={21} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{token.name}</p>
            <p className="text-xs text-[var(--color-muted)]">
              {token.token_prefix}…
              {token.last_used_at
                ? ` · Usado ${new Date(token.last_used_at).toLocaleDateString("es-UY")}`
                : " · Sin usar"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void revoke(token.id)}
            className="pressable tap-target flex items-center justify-center text-red-500"
            aria-label={`Revocar ${token.name}`}
          >
            <IconTrash size={19} />
          </button>
        </div>
      ))}

      <details className="app-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Guía de Apple Shortcuts</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-[var(--color-muted)]">
          <li>Creá un atajo y agregá “Dictar texto”.</li>
          <li>Agregá “Obtener contenido de URL” con método POST.</li>
          <li>Pegá el endpoint y agregá Authorization: Bearer TU_TOKEN.</li>
          <li>En JSON enviá text, source “siri” e idempotencyKey.</li>
          <li>Leé el campo message de la respuesta.</li>
        </ol>
      </details>
      {message ? <p className="text-xs text-[var(--color-muted)]">{message}</p> : null}
    </section>
  );
}
