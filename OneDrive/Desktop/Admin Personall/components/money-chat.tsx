"use client";

import { FormEvent, useState } from "react";
import { IconArrowUpRight, IconMessageCircle } from "@tabler/icons-react";

type Message = { role: "assistant" | "user"; text: string };
type Plan = {
  action: "reply" | "register_movement" | "create_account" | "update_account_balance" | "delete_account" | "add_savings_plan";
  message: string;
  data: { raw_text: string | null; account_id: string | null; name: string | null; institution: string | null; account_type: string | null; currency: string | null; amount: number | null };
};

type Props = { onRegistered: () => void };

export function MoneyChat({ onRegistered }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
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
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
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
      const nextPlan = data.plan as Plan;
      setMessages((current) => [...current, { role: "assistant", text: nextPlan.message }]);
      setPlan(nextPlan.action === "reply" ? null : nextPlan);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "No pude conectarme. Intentá nuevamente." }]);
    } finally {
      setSending(false);
    }
  };

  const confirmPlan = async () => {
    if (!plan || sending) return;
    setSending(true);
    try {
      if (plan.action === "register_movement") {
        const response = await fetch("/api/parse-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: plan.data.raw_text, source: "text", timezone: "America/Montevideo", dryRun: false, defaultCurrency: plan.data.currency ?? "UYU", idempotencyKey: crypto.randomUUID() }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo registrar el movimiento.");
        if (data.requiresConfirmation && data.confirmationUrl) {
          window.location.assign(data.confirmationUrl);
          return;
        }
        setMessages((current) => [...current, { role: "assistant", text: data.message ?? "Movimiento registrado." }]);
      } else {
        const response = await fetch("/api/assistant/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo completar la acción.");
        setMessages((current) => [...current, { role: "assistant", text: data.message ?? "Acción completada." }]);
      }
      setPlan(null);
      onRegistered();
      window.dispatchEvent(new Event("finance-data-changed"));
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "No se pudo completar la acción." }]);
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
      {plan ? <div className="flex gap-2 border-t border-[var(--color-border)] bg-amber-500/5 p-3"><button type="button" onClick={() => void confirmPlan()} disabled={sending} className="pressable flex-1 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white">Confirmar acción</button><button type="button" onClick={() => setPlan(null)} disabled={sending} className="pressable rounded-xl border border-[var(--color-border)] px-4 text-sm">Cancelar</button></div> : null}
    </section>
  );
}
