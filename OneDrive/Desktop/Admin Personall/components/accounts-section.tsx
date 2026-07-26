"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconPlus, IconWallet, IconX } from "@tabler/icons-react";
import { formatCurrency, SUPPORTED_CURRENCIES } from "@/lib/format";
import type { Account } from "@/lib/database.types";

export function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState<Account["type"]>("CHECKING");
  const [currency, setCurrency] = useState("UYU");
  const [balance, setBalance] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/accounts", { cache: "no-store" });
    if (response.ok) setAccounts(await response.json());
  }, []);

  useEffect(() => void load(), [load]);
  useEffect(() => setMounted(true), []);

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setInstitution("");
    setType("CHECKING");
    setCurrency("UYU");
    setBalance("0");
    setIsDefault(false);
    setError("");
    setOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setName(account.name);
    setInstitution(account.institution ?? "");
    setType(account.type);
    setCurrency(account.currency);
    setBalance(String(account.current_balance));
    setIsDefault(account.is_default);
    setError("");
    setOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const body = editing
        ? {
            name,
            institution: institution || null,
            type,
            current_balance: Number(balance),
            is_default: isDefault,
          }
        : {
            name,
            institution: institution || null,
            type,
            currency,
            initial_balance: Number(balance),
            is_savings_account: type === "SAVINGS",
            is_default: isDefault || accounts.every((account) => account.currency !== currency),
          };
      const response = await fetch(editing ? `/api/accounts?id=${editing.id}` : "/api/accounts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "No se pudo guardar la cuenta.");
        return;
      }
      closeForm();
      await load();
      window.dispatchEvent(new Event("finance-data-changed"));
    } catch {
      setError("No se pudo conectar para guardar la cuenta.");
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async () => {
    if (!editing || saving) return;
    const confirmed = window.confirm(
      `¿Eliminar “${editing.name}”? Su saldo dejará de contarse. Los movimientos anteriores se conservarán.`
    );
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/accounts?id=${editing.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "No se pudo eliminar la cuenta.");
        return;
      }
      closeForm();
      await load();
      window.dispatchEvent(new Event("finance-data-changed"));
    } catch {
      setError("No se pudo conectar para eliminar la cuenta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-label">Cuentas</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Tocá una cuenta para editarla.</p>
        </div>
        <button type="button" onClick={openCreate} className="pressable flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold text-[var(--color-accent)]" aria-label="Nueva cuenta">
          <IconPlus size={20} /> Agregar
        </button>
      </div>
      <div className="space-y-2">
        {accounts.map((account) => (
          <button type="button" key={account.id} onClick={() => openEdit(account)} className="pressable app-card flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left" aria-label={`Editar ${account.name}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${account.color}1A`, color: account.color }}>
              <IconWallet size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{account.name}</span>
              <span className="block text-xs text-[var(--color-muted)]">{account.institution || account.type.replace("_", " ")}{account.is_default ? " · Predeterminada" : ""}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold tabular-nums">{formatCurrency(Number(account.current_balance), account.currency)}</span>
              <span className="text-xs text-[var(--color-accent)]">Editar</span>
            </span>
          </button>
        ))}
      </div>

      {open && mounted
        ? createPortal(
            <div className="sheet-backdrop fixed inset-0 z-[70] flex items-end bg-black/45 px-2 pt-10 safe-bottom">
              <div className="sheet-enter sheet-panel mx-auto w-full max-w-[430px] rounded-t-[28px] bg-[var(--color-surface-elevated)] p-5 pb-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{editing ? "Editar cuenta" : "Nueva cuenta"}</h3>
                    {editing ? <p className="mt-1 text-xs text-[var(--color-muted)]">La moneda se mantiene para no alterar movimientos anteriores.</p> : null}
                  </div>
                  <button type="button" onClick={closeForm} className="pressable tap-target flex shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10" aria-label="Cerrar"><IconX size={19} /></button>
                </div>
                <form onSubmit={save} className="mt-5 space-y-3">
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la cuenta" className="app-input" required />
                  <input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Banco o institución (opcional)" className="app-input" />
                  <select value={type} onChange={(event) => setType(event.target.value as Account["type"])} className="app-input">
                    <option value="CHECKING">Cuenta bancaria</option><option value="CASH">Efectivo</option><option value="SAVINGS">Ahorros</option><option value="DIGITAL_WALLET">Billetera digital</option><option value="OTHER">Otra</option>
                  </select>
                  <div className="grid grid-cols-[1fr_1.5fr] gap-3">
                    {editing ? <div className="app-input flex items-center text-sm font-semibold text-[var(--color-muted)]">{currency}</div> : <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="app-input">{SUPPORTED_CURRENCIES.map((option) => <option key={option.code}>{option.code}</option>)}</select>}
                    <input type="number" inputMode="decimal" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder={editing ? "Saldo actual" : "Saldo inicial"} className="app-input" />
                  </div>
                  <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-black/[0.04] px-4 text-sm dark:bg-white/[0.06]">
                    <span><span className="block font-medium">Cuenta predeterminada</span><span className="block text-xs text-[var(--color-muted)]">Se usará al registrar movimientos en {currency}.</span></span>
                    <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
                  </label>
                  {error ? <p className="text-sm text-red-500">{error}</p> : null}
                  <button className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] text-base font-semibold text-white" type="submit" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear cuenta"}</button>
                  {editing ? <button type="button" onClick={() => void removeAccount()} disabled={saving} className="pressable min-h-12 w-full rounded-2xl border border-red-500/35 text-sm font-semibold text-red-500 disabled:opacity-50">Eliminar cuenta</button> : null}
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
