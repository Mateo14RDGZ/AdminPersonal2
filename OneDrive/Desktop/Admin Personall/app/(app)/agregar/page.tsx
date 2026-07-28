"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { CategoryIcon } from "@/components/category-icon";
import { addPending } from "@/lib/pending-queue";
import type { Account, Category, TransactionType } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_CURRENCIES } from "@/lib/format";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export default function AgregarPage() {
  const [amount, setAmount] = useState("0");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactionType, setTransactionType] =
    useState<TransactionType>("EXPENSE");
  const [currency, setCurrency] = useState("UYU");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [entryMode, setEntryMode] = useState<"quick" | "text">("quick");
  const [naturalText, setNaturalText] = useState("");
  const [parseMessage, setParseMessage] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"amount" | "category">("amount");

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("categories").select("*").order("name"),
      fetch("/api/accounts", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : []
      ),
    ]).then(([{ data }, accountData]) => {
      setCategories(data ?? []);
      setAccounts(accountData);
    });
  }, []);

  const numericAmount = parseFloat(amount.replace(",", ".")) || 0;

  const onKey = (key: string) => {
    if (key === "⌫") {
      setAmount((a) => (a.length <= 1 ? "0" : a.slice(0, -1)));
      return;
    }
    if (key === ".") {
      if (amount.includes(".")) return;
      setAmount((a) => (a === "0" ? "0." : `${a}.`));
      return;
    }
    setAmount((a) => (a === "0" ? key : `${a}${key}`));
  };

  const save = useCallback(
    async (categoryId: string | null) => {
      if (numericAmount <= 0 || saving) return;
      if (!accountId) {
        setParseMessage("ElegÃ­ la cuenta que se debe modificar antes de guardar el movimiento.");
        return;
      }
      if (!merchant.trim()) {
        setParseMessage("Escribí una descripción breve antes de guardar el movimiento.");
        return;
      }
      if (transactionType === "TRANSFER" && !destinationAccountId) {
        setParseMessage("ElegÃ­ la cuenta de destino para la transferencia.");
        return;
      }
      setSaving(true);
      const body = {
        type: transactionType,
        amount: numericAmount,
        currency,
        account_id: accountId,
        destination_account_id:
          transactionType === "TRANSFER" ? destinationAccountId || null : null,
        category_id: categoryId,
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        occurred_at: new Date().toISOString(),
      };

      try {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const result = await res.json().catch(() => null);
          setParseMessage(typeof result?.error === "string" ? result.error : "No se pudo guardar el movimiento.");
          setSaving(false);
          return;
        }
      } catch {
        addPending(body);
      }

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(10);
      }
      window.dispatchEvent(new Event("finance-data-changed"));
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setAmount("0");
        setMerchant("");
        setNote("");
        setStep("amount");
        setSaving(false);
      }, 900);
    },
    [
      accountId,
      currency,
      destinationAccountId,
      merchant,
      note,
      numericAmount,
      saving,
      transactionType,
    ]
  );

  const parseNaturalText = async () => {
    if (!naturalText.trim() || saving) return;
    if (!accountId) {
      setParseMessage("ElegÃ­ primero la cuenta que se debe modificar.");
      return;
    }
    setSaving(true);
    setParseMessage("");
    const response = await fetch("/api/parse-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: naturalText,
        source: "text",
        timezone: "America/Montevideo",
        defaultAccountId: accountId || null,
        defaultCurrency: currency,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setParseMessage(data.error || "No pude interpretar el movimiento.");
      return;
    }
    setParseMessage(data.message);
    if (!data.requiresConfirmation) {
      setNaturalText("");
      window.dispatchEvent(new Event("finance-data-changed"));
      navigator.vibrate?.(10);
    } else if (data.confirmationUrl) {
      setParseMessage(`${data.message}. Abrí el enlace para revisarlo.`);
    }
  };

  if (saved) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-white ios-transition"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          <IconCheck size={40} stroke={2.5} />
        </div>
        <p className="mt-4 text-lg font-medium">Guardado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="currency-tabs" role="tablist" aria-label="Modo de registro">
        <button
          type="button"
          onClick={() => setEntryMode("quick")}
          className={`currency-tab ${entryMode === "quick" ? "currency-tab-active" : ""}`}
          aria-pressed={entryMode === "quick"}
        >
          Rápido
        </button>
        <button
          type="button"
          onClick={() => setEntryMode("text")}
          className={`currency-tab ${entryMode === "text" ? "currency-tab-active" : ""}`}
          aria-pressed={entryMode === "text"}
        >
          Texto o voz
        </button>
      </div>

      {entryMode === "text" ? (
        <section className="space-y-4">
          <div className="app-card p-4">
            <label className="text-sm font-semibold" htmlFor="natural-text">
              ¿Qué movimiento hiciste?
            </label>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Ejemplo: “Gasté 450 pesos en la panadería con Itaú”
            </p>
            <textarea
              id="natural-text"
              value={naturalText}
              onChange={(event) => setNaturalText(event.target.value)}
              rows={4}
              className="app-input mt-3 resize-none"
              placeholder="Escribí o usá el dictado del teclado…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="app-input"
              aria-label="Moneda predeterminada"
            >
              {SUPPORTED_CURRENCIES.map((option) => (
                <option key={option.code}>{option.code}</option>
              ))}
            </select>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="app-input"
              aria-label="Cuenta predeterminada"
            >
              <option value="">Elegir cuenta</option>
              {accounts
                .filter((account) => account.currency === currency)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!naturalText.trim() || !accountId || saving}
            onClick={() => void parseNaturalText()}
            className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] text-base font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Interpretando…" : "Registrar movimiento"}
          </button>
          {parseMessage ? (
            <p className="rounded-2xl bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
              {parseMessage}
            </p>
          ) : null}
        </section>
      ) : (
        <>
      <header className="text-center">
        <p className="text-sm text-[var(--color-muted)]">
          {step === "amount" ? "Paso 1 · Monto" : "Paso 2 · Categoría"}
        </p>
        <p className="amount-xl mt-2 tabular-nums">
          {currency} {amount}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={transactionType}
          onChange={(event) =>
            setTransactionType(event.target.value as TransactionType)
          }
          className="app-input"
          aria-label="Tipo de movimiento"
        >
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
          <option value="TRANSFER">Transferencia</option>
          <option value="REFUND">Devolución</option>
          <option value="LOAN_GIVEN">Préstamo dado</option>
        </select>
        <select
          value={currency}
          onChange={(event) => {
            setCurrency(event.target.value);
            setAccountId("");
            setDestinationAccountId("");
          }}
          className="app-input"
          aria-label="Moneda"
        >
          {SUPPORTED_CURRENCIES.map((option) => (
            <option key={option.code}>{option.code}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="app-input"
          aria-label="Cuenta de origen"
        >
          <option value="">Cuenta</option>
          {accounts
            .filter((account) => account.currency === currency)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </select>
        {transactionType === "TRANSFER" ? (
          <select
            value={destinationAccountId}
            onChange={(event) => setDestinationAccountId(event.target.value)}
            className="app-input"
            aria-label="Cuenta de destino"
          >
            <option value="">Destino</option>
            {accounts
              .filter(
                (account) =>
                  account.currency === currency && account.id !== accountId
              )
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        ) : (
          <div className="app-input flex items-center text-sm text-[var(--color-muted)]">
            {accounts.find((account) => account.id === accountId)?.institution ||
              "Saldo actualizado"}
          </div>
        )}
      </div>

      <div className="rounded-[18px] bg-[var(--color-surface-elevated)] p-4">
        <label htmlFor="movement-description" className="text-sm font-semibold">Descripción del movimiento</label>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Obligatoria para identificar cada gasto o ingreso.</p>
        <input
          id="movement-description"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          placeholder="Ej.: Nafta, supermercado o sueldo"
          className="app-input mt-3"
          required
        />
      </div>

      {step === "amount" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onKey(key)}
                className="rounded-2xl bg-[var(--color-surface-elevated)] py-4 text-2xl font-medium ios-transition active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={numericAmount <= 0 || !accountId || (transactionType === "TRANSFER" && !destinationAccountId)}
            onClick={() => setStep("category")}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 ios-transition"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            Elegir categoría
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => void save(cat.id)}
                disabled={saving || !merchant.trim()}
                className="pressable flex flex-col items-center gap-2 rounded-[18px] bg-[var(--color-surface-elevated)] px-2 py-4 disabled:opacity-50"
              >
                <CategoryIcon name={cat.icon} size={32} color={cat.color} />
                <span className="text-center text-xs font-medium leading-tight">
                  {cat.name}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => void save(null)}
              disabled={saving || !merchant.trim()}
              className="pressable flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-[var(--color-border)] px-2 py-4 disabled:opacity-50"
            >
              <CategoryIcon name="dots" size={32} />
              <span className="text-xs font-medium">Sin categoría</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStep("amount")}
            className="text-sm text-[var(--color-muted)]"
          >
            Volver al monto
          </button>
        </>
      )}

      <div className="rounded-[18px] bg-[var(--color-surface-elevated)] p-4">
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          className="w-full text-left text-sm font-medium text-[var(--color-muted)]"
        >
          {showExtras ? "Ocultar nota" : "Agregar una nota (opcional)"}
        </button>
        {showExtras ? (
          <div className="mt-3 space-y-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota"
              className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-base outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
}
