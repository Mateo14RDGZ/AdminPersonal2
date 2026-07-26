"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendarRepeat,
  IconPigMoney,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, monthKey } from "@/lib/format";
import type { FinancialEntry } from "@/lib/database.types";

type EntryKind = "income" | "saving";

const today = () => new Date().toISOString().slice(0, 10);

export default function FinanzasPage() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<EntryKind>("income");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(today());
  const [isRecurring, setIsRecurring] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("financial_entries")
      .select("*")
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const currentMonth = monthKey();
    const applicable = entries.filter(
      (entry) =>
        entry.occurred_at <= today() &&
        (entry.is_recurring || entry.occurred_at.startsWith(currentMonth))
    );

    return {
      income: applicable
        .filter((entry) => entry.kind === "income")
        .reduce((sum, entry) => sum + Number(entry.amount), 0),
      saving: applicable
        .filter((entry) => entry.kind === "saving")
        .reduce((sum, entry) => sum + Number(entry.amount), 0),
    };
  }, [entries]);

  const openForm = (nextKind: EntryKind) => {
    setKind(nextKind);
    setName("");
    setAmount("");
    setOccurredAt(today());
    setIsRecurring(nextKind === "saving");
    setError("");
    setShowForm(true);
  };

  const saveEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Completá un nombre y un monto mayor a cero.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión venció. Volvé a iniciar sesión.");
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("financial_entries")
      .insert({
        user_id: user.id,
        kind,
        name: name.trim(),
        amount: numericAmount,
        is_recurring: kind === "saving" ? true : isRecurring,
        occurred_at: occurredAt,
      })
      .select("*")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "No se pudo guardar.");
      setSaving(false);
      return;
    }

    setEntries((current) => [data, ...current]);
    setSaving(false);
    setShowForm(false);
    window.dispatchEvent(new Event("finance-data-changed"));
    navigator.vibrate?.(10);
  };

  const deleteEntry = async (id: string) => {
    const previous = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("financial_entries")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setEntries(previous);
      setError("No se pudo eliminar el movimiento.");
      return;
    }

    window.dispatchEvent(new Event("finance-data-changed"));
  };

  return (
    <div className="space-y-6 pb-5">
      <header className="page-enter flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-muted)]">
            Plan mensual
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            Ingresos y ahorros
          </h1>
        </div>
        <button
          type="button"
          onClick={() => openForm("income")}
          className="pressable flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg shadow-emerald-900/15"
          aria-label="Agregar movimiento"
        >
          <IconPlus size={23} />
        </button>
      </header>

      <section className="page-enter-delay grid grid-cols-2 gap-3">
        <div className="app-card p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <IconArrowUp size={19} />
          </span>
          <p className="mt-4 text-xs font-medium text-[var(--color-muted)]">
            Entradas del mes
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(totals.income)}
          </p>
        </div>
        <div className="app-card p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <IconPigMoney size={19} />
          </span>
          <p className="mt-4 text-xs font-medium text-[var(--color-muted)]">
            Ahorro fijo
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(totals.saving)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openForm("income")}
          className="pressable app-card flex items-center gap-3 p-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <IconArrowDown size={21} />
          </span>
          <span>
            <span className="block text-sm font-semibold">Nueva entrada</span>
            <span className="block text-xs text-[var(--color-muted)]">
              Suma al presupuesto
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => openForm("saving")}
          className="pressable app-card flex items-center gap-3 p-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <IconPigMoney size={21} />
          </span>
          <span>
            <span className="block text-sm font-semibold">Ahorro fijo</span>
            <span className="block text-xs text-[var(--color-muted)]">
              Reserva mensual
            </span>
          </span>
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Movimientos configurados</h2>
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-16 rounded-[18px]" />
            <div className="skeleton h-16 rounded-[18px]" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            title="Armá tu presupuesto"
            description="Agregá tus ingresos y el monto que querés reservar todos los meses."
          />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="app-card content-auto flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    entry.kind === "income"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {entry.kind === "income" ? (
                    <IconArrowUp size={20} />
                  ) : (
                    <IconPigMoney size={20} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{entry.name}</p>
                  <p className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                    {entry.is_recurring ? (
                      <>
                        <IconCalendarRepeat size={13} />
                        Todos los meses
                      </>
                    ) : (
                      new Intl.DateTimeFormat("es-AR", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(`${entry.occurred_at}T12:00:00`))
                    )}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {entry.kind === "income" ? "+" : "−"}
                  {formatCurrency(Number(entry.amount))}
                </p>
                <button
                  type="button"
                  onClick={() => void deleteEntry(entry.id)}
                  className="pressable -mr-1 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-muted)] hover:text-red-500"
                  aria-label={`Eliminar ${entry.name}`}
                >
                  <IconTrash size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && !showForm ? (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <div className="sheet-backdrop fixed inset-0 z-[70] flex items-end bg-black/45 px-3 pt-12 safe-bottom">
          <div className="sheet-enter mx-auto w-full max-w-lg rounded-t-[28px] bg-[var(--color-surface-elevated)] p-5 pb-7 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">
                  {kind === "income" ? "ENTRADA DE DINERO" : "AHORRO FIJO"}
                </p>
                <h2 className="mt-0.5 text-xl font-semibold">
                  {kind === "income" ? "Sumar al presupuesto" : "Reservar cada mes"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                aria-label="Cerrar"
              >
                <IconX size={19} />
              </button>
            </div>

            <form onSubmit={(event) => void saveEntry(event)} className="mt-5 space-y-3">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  kind === "income" ? "Ej: Sueldo, venta, extra" : "Ej: Fondo de emergencia"
                }
                maxLength={120}
                required
                className="app-input"
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  required
                  className="app-input pl-8 text-lg font-semibold tabular-nums"
                />
              </div>
              <input
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                required
                className="app-input"
              />

              {kind === "income" ? (
                <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-black/[0.035] px-4 py-3 dark:bg-white/[0.06]">
                  <span>
                    <span className="block text-sm font-medium">
                      Repetir todos los meses
                    </span>
                    <span className="block text-xs text-[var(--color-muted)]">
                      Ideal para sueldo o ingreso fijo
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(event) => setIsRecurring(event.target.checked)}
                    className="h-5 w-5 accent-[var(--color-accent)]"
                  />
                </label>
              ) : (
                <p className="rounded-2xl bg-blue-500/10 px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
                  Este monto se reservará automáticamente en el cálculo de cada mes.
                </p>
              )}

              {error ? (
                <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="pressable w-full rounded-2xl bg-[var(--color-accent)] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
