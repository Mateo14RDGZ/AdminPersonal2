"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Account, Category, TransactionType } from "@/lib/database.types";
import { SUPPORTED_CURRENCIES } from "@/lib/format";

type Payload = {
  type?: TransactionType;
  amount?: number | null;
  currency?: string;
  accountId?: string | null;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  merchant?: string | null;
  occurredAt?: string;
  source?: string;
};

export default function ConfirmarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = useState<Payload>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/confirmations/${id}`, { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject()
      ),
      fetch("/api/accounts", { cache: "no-store" }).then((response) =>
        response.json()
      ),
      import("@/lib/supabase/client").then(async ({ createClient }) => {
        const { data } = await createClient()
          .from("categories")
          .select("*")
          .order("name");
        return data ?? [];
      }),
    ])
      .then(([pending, accountData, categoryData]) => {
        setPayload(pending.parsed_payload ?? {});
        setAccounts(accountData);
        setCategories(categoryData);
      })
      .catch(() => setError("Esta confirmación venció o ya fue utilizada."))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    const response = await fetch(`/api/confirmations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: payload.type ?? "EXPENSE",
        amount: payload.amount,
        currency: payload.currency ?? "UYU",
        account_id: payload.accountId,
        destination_account_id: payload.destinationAccountId ?? null,
        category_id: payload.categoryId ?? null,
        merchant: payload.merchant ?? null,
        occurred_at: payload.occurredAt ?? new Date().toISOString(),
        source: payload.source ?? "text",
        idempotency_key: crypto.randomUUID(),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (typeof body?.error === "string") {
        setError(body.error);
        return;
      }
      setError("Revisá el monto, la moneda y la cuenta.");
      return;
    }
    window.dispatchEvent(new Event("finance-data-changed"));
    router.replace("/inicio");
  };

  const discard = async () => {
    if (saving || !window.confirm("Descartar este movimiento pendiente? No se guardara ningun gasto.")) return;
    setSaving(true);
    const response = await fetch(`/api/confirmations/${id}`, { method: "DELETE" });
    setSaving(false);
    if (!response.ok) { setError("No se pudo descartar el movimiento."); return; }
    window.dispatchEvent(new Event("finance-data-changed"));
    router.replace("/inicio");
  };

  if (loading) return <div className="skeleton h-80 rounded-[24px]" />;
  if (error && !payload.amount) {
    return <p className="app-card p-5 text-sm text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-[var(--color-muted)]">Revisión necesaria</p>
        <h1 className="text-2xl font-semibold">Confirmar movimiento</h1>
      </header>
      <form onSubmit={save} className="app-card space-y-3 p-4">
        <select
          value={payload.type ?? "EXPENSE"}
          onChange={(event) =>
            setPayload({ ...payload, type: event.target.value as TransactionType })
          }
          className="app-input"
        >
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
          <option value="TRANSFER">Transferencia</option>
          <option value="REFUND">Devolución</option>
          <option value="LOAN_GIVEN">Préstamo dado</option>
        </select>
        <div className="grid grid-cols-[1fr_1.6fr] gap-3">
          <select
            value={payload.currency ?? "UYU"}
            onChange={(event) =>
              setPayload({ ...payload, currency: event.target.value })
            }
            className="app-input"
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency.code}>{currency.code}</option>
            ))}
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={payload.amount ?? ""}
            onChange={(event) =>
              setPayload({ ...payload, amount: Number(event.target.value) })
            }
            placeholder="Monto"
            className="app-input"
            required
          />
        </div>
        <select
          value={payload.accountId ?? ""}
          onChange={(event) =>
            setPayload({ ...payload, accountId: event.target.value })
          }
          className="app-input"
          required
        >
          <option value="">Elegir cuenta</option>
          {accounts
            .filter((account) => account.currency === (payload.currency ?? "UYU"))
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </select>
        <select
          value={payload.categoryId ?? ""}
          onChange={(event) =>
            setPayload({ ...payload, categoryId: event.target.value || null })
          }
          className="app-input"
        >
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          value={payload.merchant ?? ""}
          onChange={(event) =>
            setPayload({ ...payload, merchant: event.target.value })
          }
          placeholder="Comercio o descripción"
          className="app-input"
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="pressable min-h-13 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white"
        >
          Confirmar y guardar
        </button>
        <button
          type="button"
          onClick={() => void discard()}
          disabled={saving}
          className="pressable min-h-12 w-full rounded-2xl border border-red-400/35 bg-red-500/8 text-sm font-semibold text-red-500"
        >
          Eliminar movimiento pendiente
        </button>
      </form>
    </div>
  );
}
