"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { CategoryIcon } from "@/components/category-icon";
import { addPending } from "@/lib/pending-queue";
import type { Category } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export default function AgregarPage() {
  const [amount, setAmount] = useState("0");
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"amount" | "category">("amount");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
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
      setSaving(true);
      const body = {
        amount: numericAmount,
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
        if (!res.ok) throw new Error("network");
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
    [merchant, note, numericAmount, saving]
  );

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
      <header className="text-center">
        <p className="text-sm text-[var(--color-muted)]">
          {step === "amount" ? "Paso 1 · Monto" : "Paso 2 · Categoría"}
        </p>
        <p className="amount-xl mt-2 tabular-nums">
          ${amount}
        </p>
      </header>

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
            disabled={numericAmount <= 0}
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
                disabled={saving}
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
              disabled={saving}
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
          {showExtras ? "Ocultar detalles" : "Comercio y nota (opcional)"}
        </button>
        {showExtras ? (
          <div className="mt-3 space-y-3">
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Comercio"
              className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-base outline-none focus:border-[var(--color-accent)]"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota"
              className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-base outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
