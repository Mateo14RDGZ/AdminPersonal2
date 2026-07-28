"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { IconCalendarRepeat, IconPlus, IconX } from "@tabler/icons-react";
import { formatCurrency, SUPPORTED_CURRENCIES } from "@/lib/format";
import type { Account, RecurringTransaction } from "@/lib/database.types";
import { BottomSheet } from "@/components/app-motion";

export function RecurringSection() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UYU");
  const [accountId, setAccountId] = useState("");
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const [recurringResponse, accountsResponse] = await Promise.all([
      fetch("/api/recurring", { cache: "no-store" }),
      fetch("/api/accounts", { cache: "no-store" }),
    ]);
    if (recurringResponse.ok) setItems(await recurringResponse.json());
    if (accountsResponse.ok) setAccounts(await accountsResponse.json());
  }, []);
  useEffect(() => void load(), [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "EXPENSE",
        merchant,
        amount: Number(amount),
        currency,
        account_id: accountId,
        frequency: "MONTHLY",
        next_execution_date: nextDate,
        auto_create: false,
      }),
    });
    if (!response.ok) return;
    setOpen(false);
    setMerchant("");
    setAmount("");
    await load();
    window.dispatchEvent(new Event("finance-data-changed"));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-label">Próximos pagos</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Recurrentes y calendario financiero
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="tap-target flex items-center justify-center text-[var(--color-accent)]" aria-label="Nuevo pago recurrente">
          <IconPlus size={22} />
        </button>
      </div>
      {items.map((item) => (
        <div key={item.id} className="app-card flex min-h-16 items-center gap-3 px-4 py-3">
          <IconCalendarRepeat className="text-orange-500" size={22} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.merchant || item.description || "Pago recurrente"}</p>
            <p className="text-xs text-[var(--color-muted)]">
              Próximo: {new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short" }).format(new Date(`${item.next_execution_date}T12:00:00`))}
            </p>
          </div>
          <p className="font-semibold">{formatCurrency(Number(item.amount), item.currency)}</p>
        </div>
      ))}
      <BottomSheet open={open} labelledBy="recurring-sheet-title">
            <div className="flex items-center justify-between">
              <h3 id="recurring-sheet-title" className="text-xl font-semibold">Pago mensual</h3>
              <button type="button" onClick={() => setOpen(false)} className="tap-target flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10" aria-label="Cerrar"><IconX size={19} /></button>
            </div>
            <form onSubmit={save} className="mt-5 space-y-3">
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Servicio o comercio" required className="app-input" />
              <div className="grid grid-cols-[1fr_1.5fr] gap-3">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="app-input">
                  {SUPPORTED_CURRENCIES.map((option) => <option key={option.code}>{option.code}</option>)}
                </select>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto" required className="app-input" />
              </div>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="app-input" required>
                <option value="">Elegir cuenta</option>
                {accounts.filter((account) => account.currency === currency).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required className="app-input" />
              <button type="submit" className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white">Guardar próximo pago</button>
            </form>
      </BottomSheet>
    </section>
  );
}
