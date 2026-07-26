"use client";

import { FormEvent, useState } from "react";
import { IconArrowUpRight, IconMessageCircle } from "@tabler/icons-react";

type Message = { role: "assistant" | "user"; text: string };

type Props = { onRegistered: () => void };

export function MoneyChat({ onRegistered }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Escribime un movimiento. Por ejemplo: “Gasté 500 pesos en nafta” o “Cobré 30.000 de sueldo”.",
    },
  ]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setMessages((current) => [...current, { role: "user", text: value }]);
    setText("");
    setSending(true);
    try {
      const response = await fetch("/api/parse-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
          source: "text",
          timezone: "America/Montevideo",
          dryRun: false,
          defaultCurrency: "UYU",
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessages((current) => [
          ...current,
          { role: "assistant", text: typeof data?.error === "string" ? data.error : "No pude entender ese movimiento." },
        ]);
        return;
      }
      setMessages((current) => [...current, { role: "assistant", text: data.message ?? "Movimiento procesado." }]);
      if (data.requiresConfirmation && data.confirmationUrl) {
        window.location.assign(data.confirmationUrl);
        return;
      }
      onRegistered();
      window.dispatchEvent(new Event("finance-data-changed"));
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "No pude conectarme. Intentá nuevamente." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="app-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]"><IconMessageCircle size={20} /></span>
        <div>
          <h2 className="text-sm font-semibold">Asistente de movimientos</h2>
          <p className="text-xs text-[var(--color-muted)]">Entiende frases en español.</p>
        </div>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.slice(-4).map((message, index) => (
          <p key={`${message.role}-${index}`} className={`w-fit max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-[var(--color-accent)] text-white" : "bg-black/[0.045] text-[var(--color-text)] dark:bg-white/[0.08]"}`}>
            {message.text}
          </p>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-[var(--color-border)] p-3">
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ej: gasté 500 en nafta" className="app-input min-w-0 flex-1 py-2.5" disabled={sending} />
        <button type="submit" disabled={!text.trim() || sending} className="pressable tap-target flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white disabled:opacity-40" aria-label="Enviar movimiento">
          <IconArrowUpRight size={21} />
        </button>
      </form>
    </section>
  );
}
