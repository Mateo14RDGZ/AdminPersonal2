"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconCreditCard, IconPlus, IconX } from "@tabler/icons-react";
import { formatCurrency, SUPPORTED_CURRENCIES } from "@/lib/format";
import type { CreditCard } from "@/lib/database.types";
import { BottomSheet } from "@/components/app-motion";

export function CardsSection() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("UYU");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/cards", { cache: "no-store" });
    if (response.ok) setCards(await response.json());
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => setMounted(true), []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          institution: institution || null,
          currency,
          credit_limit: Number(limit),
          closing_day: closingDay ? Number(closingDay) : null,
          due_day: dueDay ? Number(dueDay) : null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "No se pudo crear la tarjeta. Revisá los datos e intentá nuevamente."
        );
        return;
      }
      setOpen(false);
      setName("");
      setInstitution("");
      setLimit("");
      setClosingDay("");
      setDueDay("");
      await load();
      window.dispatchEvent(new Event("finance-data-changed"));
    } catch {
      setError("No se pudo conectar para crear la tarjeta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-label">Tarjetas de crédito</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Límite, utilizado, cierre y vencimiento
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold text-[var(--color-accent)]"
          aria-label="Nueva tarjeta"
        >
          <IconPlus size={20} /> Agregar
        </button>
      </div>
      {cards.map((card) => {
        const available = Number(card.credit_limit) - Number(card.current_used_amount);
        const usedPercentage =
          Number(card.credit_limit) > 0
            ? Math.min(100, (Number(card.current_used_amount) / Number(card.credit_limit)) * 100)
            : 0;
        return (
          <div key={card.id} className="app-card p-4">
            <div className="flex items-center gap-3">
              <IconCreditCard className="text-[var(--color-accent)]" size={24} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{card.name}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {card.institution || card.currency}
                  {card.closing_day ? ` · Cierra ${card.closing_day}` : ""}
                  {card.due_day ? ` · Vence ${card.due_day}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(available, card.currency)}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)]"
                style={{ width: `${usedPercentage}%` }}
              />
            </div>
          </div>
        );
      })}
      {mounted
        ? createPortal(
        <BottomSheet open={open} labelledBy="card-sheet-title">
            <div className="flex items-center justify-between">
              <h3 id="card-sheet-title" className="text-xl font-semibold">Nueva tarjeta</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tap-target flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                aria-label="Cerrar"
              >
                <IconX size={19} />
              </button>
            </div>
            <form onSubmit={save} className="mt-5 space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required className="app-input" />
              <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Banco (opcional)" className="app-input" />
              <div className="grid grid-cols-2 gap-3">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="app-input">
                  {SUPPORTED_CURRENCIES.map((option) => <option key={option.code}>{option.code}</option>)}
                </select>
                <input type="number" min="0" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Límite" required className="app-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} placeholder="Día de cierre" className="app-input" />
                <input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="Vencimiento" className="app-input" />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <button
                type="submit"
                disabled={saving}
                className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white"
              >
                {saving ? "Creando…" : "Crear tarjeta"}
              </button>
            </form>
        </BottomSheet>
        , document.body)
        : null}
    </section>
  );
}
