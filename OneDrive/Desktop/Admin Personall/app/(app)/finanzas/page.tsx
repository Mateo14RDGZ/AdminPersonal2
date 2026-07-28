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
import { GoalsSection } from "@/components/goals-section";
import { RecurringSection } from "@/components/recurring-section";
import { BottomSheet } from "@/components/app-motion";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrency,
  monthKey,
  SUPPORTED_CURRENCIES,
} from "@/lib/format";
import type { Account, FinancialEntry } from "@/lib/database.types";

type EntryKind = "income" | "saving";
type CurrencyTotal = { income: number; saving: number };

const today = () => new Date().toISOString().slice(0, 10);

export default function FinanzasPage() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<EntryKind>("income");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UYU");
  const [summaryCurrency, setSummaryCurrency] = useState("UYU");
  const [occurredAt, setOccurredAt] = useState(today());
  const [isRecurring, setIsRecurring] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [entriesResult, accountsResult] = await Promise.all([
      supabase.from("financial_entries").select("*").order("occurred_at", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").eq("is_archived", false),
    ]);
    setEntries(entriesResult.data ?? []);
    setAccounts(accountsResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalsByCurrency = useMemo(() => {
    const currentMonth = monthKey();
    const totals = new Map<string, CurrencyTotal>();

    for (const entry of entries) {
      if (
        entry.occurred_at > today() ||
        (!entry.is_recurring && !entry.occurred_at.startsWith(currentMonth))
      ) {
        continue;
      }

      const entryCurrency = entry.currency || "UYU";
      const current = totals.get(entryCurrency) ?? { income: 0, saving: 0 };
      current[entry.kind] += Number(entry.amount);
      totals.set(entryCurrency, current);
    }

    return totals;
  }, [entries]);

  const visibleCurrencies = useMemo(() => {
    const configured = new Set(totalsByCurrency.keys());
    configured.add("UYU");
    configured.add("USD");
    return SUPPORTED_CURRENCIES.filter(({ code }) => configured.has(code));
  }, [totalsByCurrency]);

  const totals = totalsByCurrency.get(summaryCurrency) ?? {
    income: 0,
    saving: 0,
  };
  const reservedSavings = useMemo(
    () => accounts.filter((account) => account.is_savings_account && account.currency === summaryCurrency).reduce((sum, account) => sum + Number(account.current_balance), 0),
    [accounts, summaryCurrency]
  );

  const openForm = (nextKind: EntryKind) => {
    setKind(nextKind);
    setName("");
    setAmount("");
    setCurrency(nextKind === "saving" ? "USD" : "UYU");
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
        currency,
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
    setSummaryCurrency(currency);
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
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          className="pressable tap-target flex shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg shadow-emerald-900/15"
          aria-label="Agregar movimiento"
        >
          <IconPlus size={23} />
        </button>
      </header>

      <section className="space-y-3">
        <div
          className="currency-tabs"
          role="group"
          aria-label="Moneda del resumen"
        >
          {visibleCurrencies.map(({ code }) => (
            <button
              key={code}
              type="button"
              onClick={() => setSummaryCurrency(code)}
              className={`pressable currency-tab ${
                summaryCurrency === code ? "currency-tab-active" : ""
              }`}
              aria-pressed={summaryCurrency === code}
            >
              {code}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="app-card min-w-0 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IconArrowUp size={19} />
            </span>
            <p className="mt-4 text-xs font-medium text-[var(--color-muted)]">
              Entradas del mes
            </p>
            <p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(totals.income, summaryCurrency)}
            </p>
          </div>
          <div className="app-card min-w-0 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <IconPigMoney size={19} />
            </span>
            <p className="mt-4 text-xs font-medium text-[var(--color-muted)]">
              Ahorro reservado
            </p>
            <p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(reservedSavings, summaryCurrency)}
            </p>
          </div>
        </div>
        <p className="px-1 text-xs leading-relaxed text-[var(--color-muted)]">
          Cada moneda se calcula por separado. No convertimos ni mezclamos
          pesos, dólares u otras monedas.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openForm("income")}
          className="pressable app-card flex min-h-20 min-w-0 items-center gap-3 p-3 text-left min-[390px]:p-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <IconArrowDown size={21} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Nueva entrada</span>
            <span className="block text-xs leading-tight text-[var(--color-muted)]">
              Suma al presupuesto
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => openForm("saving")}
          className="pressable app-card flex min-h-20 min-w-0 items-center gap-3 p-3 text-left min-[390px]:p-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <IconPigMoney size={21} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Ahorro fijo</span>
            <span className="block text-xs leading-tight text-[var(--color-muted)]">
              Elegí la moneda
            </span>
          </span>
        </button>
      </section>

      <GoalsSection />

      <RecurringSection />

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
                className="app-card content-auto flex min-h-16 items-center gap-3 px-3 py-2.5 min-[390px]:px-4"
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
                      new Intl.DateTimeFormat("es-UY", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(`${entry.occurred_at}T12:00:00`))
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums min-[390px]:text-base">
                  {entry.kind === "income" ? "+" : "−"}
                  {formatCurrency(
                    Number(entry.amount),
                    entry.currency || "UYU"
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void deleteEntry(entry.id)}
                  className="pressable tap-target -mr-2 flex items-center justify-center rounded-xl text-[var(--color-muted)] hover:text-red-500"
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

      <BottomSheet open={showForm} className="min-[390px]:px-3" panelClassName="shadow-2xl" labelledBy="finance-sheet-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">
                  {kind === "income" ? "ENTRADA DE DINERO" : "AHORRO FIJO"}
                </p>
                <h2 id="finance-sheet-title" className="mt-0.5 text-xl font-semibold">
                  {kind === "income"
                    ? "Sumar al presupuesto"
                    : "Reservar cada mes"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="pressable tap-target flex shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                aria-label="Cerrar"
              >
                <IconX size={19} />
              </button>
            </div>

            <form
              onSubmit={(event) => void saveEntry(event)}
              className="mt-5 space-y-3"
            >
              <label className="sr-only" htmlFor="finance-name">
                Nombre
              </label>
              <input
                id="finance-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  kind === "income"
                    ? "Ej: Sueldo, venta, extra"
                    : "Ej: Fondo de emergencia"
                }
                maxLength={120}
                required
                className="app-input"
              />

              <div>
                <label
                  htmlFor="finance-currency"
                  className="mb-1.5 block px-1 text-xs font-medium text-[var(--color-muted)]"
                >
                  Moneda
                </label>
                <select
                  id="finance-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="app-input appearance-none"
                >
                  {SUPPORTED_CURRENCIES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.code} · {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted)]">
                  {currency}
                </span>
                <label className="sr-only" htmlFor="finance-amount">
                  Monto
                </label>
                <input
                  id="finance-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                  required
                  className="app-input pl-14 text-lg font-semibold tabular-nums"
                />
              </div>

              <label className="sr-only" htmlFor="finance-date">
                Fecha
              </label>
              <input
                id="finance-date"
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                required
                className="app-input"
              />

              {kind === "income" ? (
                <label className="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-black/[0.035] px-4 py-3 dark:bg-white/[0.06]">
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
                    className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
                  />
                </label>
              ) : (
                <p className="rounded-2xl bg-blue-500/10 px-4 py-3 text-xs leading-relaxed text-blue-700 dark:text-blue-300">
                  Se reservará {currency} automáticamente cada mes, sin
                  convertirlo ni mezclarlo con otras monedas.
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
                className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] px-5 py-3.5 text-base font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </form>
      </BottomSheet>
    </div>
  );
}
