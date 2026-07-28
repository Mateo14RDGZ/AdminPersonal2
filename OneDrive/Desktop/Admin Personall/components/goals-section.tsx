"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { IconPlus, IconTargetArrow, IconX } from "@tabler/icons-react";
import { formatCurrency, SUPPORTED_CURRENCIES } from "@/lib/format";
import type { SavingsGoal } from "@/lib/database.types";
import { BottomSheet } from "@/components/app-motion";

export function GoalsSection() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [targetDate, setTargetDate] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/goals", { cache: "no-store" });
    if (response.ok) setGoals(await response.json());
  }, []);
  useEffect(() => void load(), [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        target_amount: Number(target),
        current_amount: Number(current),
        currency,
        target_date: targetDate || null,
        is_primary: goals.length === 0,
      }),
    });
    if (!response.ok) return;
    setOpen(false);
    setName("");
    setTarget("");
    setCurrent("0");
    await load();
    window.dispatchEvent(new Event("finance-data-changed"));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-label">Metas de ahorro</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Objetivo, progreso y fecha estimada
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable tap-target flex items-center justify-center rounded-xl text-[var(--color-accent)]"
          aria-label="Nueva meta"
        >
          <IconPlus size={22} />
        </button>
      </div>
      {goals.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable app-card flex min-h-20 w-full items-center gap-3 p-4 text-left"
        >
          <IconTargetArrow className="text-[var(--color-accent)]" size={26} />
          <span>
            <span className="block font-semibold">Creá tu primera meta</span>
            <span className="text-xs text-[var(--color-muted)]">
              Viaje, fondo de emergencia o una compra
            </span>
          </span>
        </button>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const percentage = Math.min(
              100,
              (Number(goal.current_amount) / Number(goal.target_amount)) * 100
            );
            return (
              <div key={goal.id} className="app-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{goal.name}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {formatCurrency(Number(goal.current_amount), goal.currency)}
                      {" de "}
                      {formatCurrency(Number(goal.target_amount), goal.currency)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {Math.round(percentage)}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="progress-bar h-full rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Faltan{" "}
                  {formatCurrency(
                    Math.max(
                      0,
                      Number(goal.target_amount) - Number(goal.current_amount)
                    ),
                    goal.currency
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <BottomSheet open={open} labelledBy="goal-sheet-title">
            <div className="flex items-center justify-between">
              <h3 id="goal-sheet-title" className="text-xl font-semibold">Nueva meta</h3>
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
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre de la meta"
                required
                className="app-input"
              />
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="app-input"
              >
                {SUPPORTED_CURRENCIES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} · {option.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="Monto objetivo"
                required
                className="app-input"
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                placeholder="Ya ahorrado"
                className="app-input"
              />
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="app-input"
              />
              <button
                type="submit"
                className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] text-base font-semibold text-white"
              >
                Crear meta
              </button>
            </form>
      </BottomSheet>
    </section>
  );
}
