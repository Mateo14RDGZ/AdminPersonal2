"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icon";
import { formatCurrency, formatTime, sourceLabel, monthKey } from "@/lib/format";
import type { TransactionWithCategory } from "@/lib/database.types";

type Summary = {
  month: string;
  totalSpent: number;
  categories: {
    category_id: string;
    name: string;
    icon: string;
    color: string;
    budget: number | null;
    spent: number;
    overBudget: boolean;
  }[];
};

export default function InicioPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [today, setToday] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const month = monthKey();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [sumRes, txRes] = await Promise.all([
      fetch(`/api/budgets/summary?month=${month}`),
      fetch(
        `/api/transactions?from=${start.toISOString()}&limit=20`
      ),
    ]);
    if (sumRes.ok) setSummary(await sumRes.json());
    if (txRes.ok) {
      const json = await txRes.json();
      setToday(json.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withBudget = summary?.categories.filter((c) => c.budget != null) ?? [];

  return (
    <div className="space-y-8 pb-4">
      <header>
        <p className="text-sm text-[var(--color-muted)]">Gastado este mes</p>
        <p className="amount-xl mt-1">
          {loading ? "—" : formatCurrency(summary?.totalSpent ?? 0)}
        </p>
      </header>

      {withBudget.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">Presupuestos</h2>
          <div className="space-y-3">
            {withBudget.map((cat) => {
              const pct =
                cat.budget && cat.budget > 0
                  ? Math.min(100, (cat.spent / cat.budget) * 100)
                  : 0;
              const barColor = cat.overBudget ? "#F97316" : cat.color;
              return (
                <div
                  key={cat.category_id}
                  className="rounded-[18px] bg-[var(--color-surface-elevated)] p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CategoryIcon name={cat.icon} size={20} color={cat.color} />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <span className="text-sm text-[var(--color-muted)]">
                      {formatCurrency(cat.spent)}
                      {cat.budget != null ? ` / ${formatCurrency(cat.budget)}` : ""}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full ios-transition"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">Hoy</h2>
          <Link href="/movimientos" className="text-sm text-[var(--color-accent)]">
            Ver todo
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Cargando…</p>
        ) : today.length === 0 ? (
          <EmptyState
            title="Nada por hoy"
            description="Cuando registres un gasto, aparecerá acá al instante."
            action={
              <Link
                href="/agregar"
                className="inline-flex rounded-2xl px-5 py-2.5 text-sm font-medium text-white"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                Agregar gasto
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {today.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between rounded-[18px] bg-[var(--color-surface-elevated)] px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {tx.merchant || tx.categories?.name || "Gasto"}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {sourceLabel(tx.source)} · {formatTime(tx.occurred_at)}
                  </p>
                </div>
                <span className="amount-lg">{formatCurrency(Number(tx.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
