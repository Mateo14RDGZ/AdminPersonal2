"use client";

import { FormEvent, useState } from "react";
import { IconArrowUpRight, IconBolt, IconCheck, IconMessageCircle, IconSparkles, IconX } from "@tabler/icons-react";

type Message = { role: "assistant" | "user"; text: string };
type Plan = {
  action: "reply" | "register_movement" | "create_account" | "create_category" | "update_account_balance" | "delete_account" | "add_savings_plan" | "create_card" | "create_goal" | "create_recurring_payment" | "set_category_budget";
  message: string;
  data: { raw_text: string | null; account_id: string | null; category_id: string | null; name: string | null; institution: string | null; account_type: string | null; currency: string | null; amount: number | null; target_amount: number | null; date: string | null };
};

type Props = { onRegistered: () => void };

export function MoneyChat({ onRegistered }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "Puedo registrar movimientos y ayudarte con cuentas, tarjetas, metas y pagos." }]);
  const suggestions = ["Gasté 500 en nafta", "Creá una cuenta en dólares", "Quiero ahorrar 200 por mes"];

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setMessages((current) => [...current, { role: "user", text: value }]);
    setText("");
    setSending(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessages((current) => [...current, { role: "assistant", text: typeof data?.error === "string" ? data.error : "No pude entender ese mensaje." }]);
        return;
      }
      const nextPlan = data.plan as Plan;
      setMessages((current) => [...current, { role: "assistant", text: nextPlan.message }]);
      setPlan(nextPlan.action === "reply" ? null : nextPlan);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "No pude conectarme. Intentá nuevamente." }]);
    } finally { setSending(false); }
  };

  const confirmPlan = async () => {
    if (!plan || sending) return;
    setSending(true);
    try {
      if (plan.action === "register_movement") {
        const response = await fetch("/api/parse-transaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: plan.data.raw_text, source: "text", timezone: "America/Montevideo", dryRun: false, defaultCurrency: plan.data.currency ?? "UYU", idempotencyKey: crypto.randomUUID() }) });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo registrar el movimiento.");
        if (data.requiresConfirmation && data.confirmationUrl) { window.location.assign(data.confirmationUrl); return; }
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
    } finally { setSending(false); }
  };

  return (
    <section className="assistant-card app-card overflow-hidden">
      <div className="assistant-glow pointer-events-none absolute" aria-hidden="true" />
      <div className="relative flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-4">
        <span className="assistant-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-emerald-900/20"><IconSparkles size={21} stroke={2.2} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">Asistente financiero</h2><span className="flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]"><IconBolt size={11} fill="currentColor" /> Listo</span></div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">Escribí como hablás. Te muestra el cambio antes de hacerlo.</p>
        </div>
        <IconMessageCircle className="text-[var(--color-muted)]" size={20} />
      </div>
      <div className="relative flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none" aria-label="Ejemplos rápidos">
        {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setText(suggestion)} disabled={sending} className="pressable shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--color-muted)]">{suggestion}</button>)}
      </div>
      <div className="relative max-h-52 space-y-2 overflow-y-auto px-4 pb-3" aria-live="polite">
        {messages.slice(-4).map((message, index) => <p key={`${message.role}-${index}`} className={`w-fit max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-[var(--color-accent)] text-white" : "bg-black/[0.045] text-[var(--color-text)] dark:bg-white/[0.08]"}`}>{message.text}</p>)}
      </div>
      <form onSubmit={send} className="relative flex gap-2 border-t border-[var(--color-border)] bg-black/[0.012] p-3 dark:bg-white/[0.015]">
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ej: gasté 500 en nafta" className="app-input min-w-0 flex-1 border-transparent bg-[var(--color-surface-elevated)] py-2.5 shadow-sm" disabled={sending} />
        <button type="submit" disabled={!text.trim() || sending} className="pressable tap-target flex shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg shadow-emerald-900/20 disabled:opacity-40" aria-label="Enviar mensaje"><IconArrowUpRight size={21} /></button>
      </form>
      {plan ? <div className="relative assistant-confirm mx-3 mb-3 flex items-center gap-2 rounded-2xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 p-2"><button type="button" onClick={() => void confirmPlan()} disabled={sending} className="pressable flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-3 text-sm font-semibold text-white"><IconCheck size={18} /> Confirmar</button><button type="button" onClick={() => setPlan(null)} disabled={sending} className="pressable tap-target flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm" aria-label="Cancelar acción"><IconX size={18} /></button></div> : null}
    </section>
  );
}
