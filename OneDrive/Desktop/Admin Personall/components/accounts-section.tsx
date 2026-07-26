"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { IconPlus, IconWallet, IconX } from "@tabler/icons-react";
import { formatCurrency, SUPPORTED_CURRENCIES } from "@/lib/format";
import type { Account } from "@/lib/database.types";

export function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState<Account["type"]>("CHECKING");
  const [currency, setCurrency] = useState("UYU");
  const [balance, setBalance] = useState("0");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/accounts", { cache: "no-store" });
    if (response.ok) setAccounts(await response.json());
  }, []);

  useEffect(() => void load(), [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          institution: institution || null,
          type,
          currency,
          initial_balance: Number(balance),
          is_savings_account: type === "SAVINGS",
          is_default: accounts.every((account) => account.currency !== currency),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "No se pudo crear la cuenta. Revisá los datos e intentá nuevamente."
        );
        return;
      }
      setOpen(false);
      setName("");
      setInstitution("");
      setBalance("0");
      await load();
      window.dispatchEvent(new Event("finance-data-changed"));
    } catch {
      setError("No se pudo conectar para crear la cuenta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-label">Cuentas</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Saldos reales separados por moneda
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold text-[var(--color-accent)]"
          aria-label="Nueva cuenta"
        >
          <IconPlus size={20} /> Agregar
        </button>
      </div>
      <div className="space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="app-card flex min-h-16 items-center gap-3 px-4 py-3"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${account.color}1A`, color: account.color }}
            >
              <IconWallet size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{account.name}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {account.institution || account.type.replace("_", " ")}
                {account.is_default ? " · Predeterminada" : ""}
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatCurrency(Number(account.current_balance), account.currency)}
            </p>
          </div>
        ))}
      </div>

      {open ? (
        <div className="sheet-backdrop fixed inset-0 z-[70] flex items-end bg-black/45 px-2 pt-10 safe-bottom">
          <div className="sheet-enter sheet-panel mx-auto w-full max-w-[430px] rounded-t-[28px] bg-[var(--color-surface-elevated)] p-5 pb-7">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Nueva cuenta</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="pressable tap-target flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                aria-label="Cerrar"
              >
                <IconX size={19} />
              </button>
            </div>
            <form onSubmit={save} className="mt-5 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre de la cuenta"
                className="app-input"
                required
              />
              <input
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                placeholder="Banco o institución (opcional)"
                className="app-input"
              />
              <select
                value={type}
                onChange={(event) => setType(event.target.value as Account["type"])}
                className="app-input"
              >
                <option value="CHECKING">Cuenta bancaria</option>
                <option value="CASH">Efectivo</option>
                <option value="SAVINGS">Ahorros</option>
                <option value="DIGITAL_WALLET">Billetera digital</option>
                <option value="OTHER">Otra</option>
              </select>
              <div className="grid grid-cols-[1fr_1.5fr] gap-3">
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="app-input"
                >
                  {SUPPORTED_CURRENCIES.map((option) => (
                    <option key={option.code}>{option.code}</option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={balance}
                  onChange={(event) => setBalance(event.target.value)}
                  placeholder="Saldo inicial"
                  className="app-input"
                />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <button
                className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] text-base font-semibold text-white"
                type="submit"
                disabled={saving}
              >
                {saving ? "Creando…" : "Crear cuenta"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
