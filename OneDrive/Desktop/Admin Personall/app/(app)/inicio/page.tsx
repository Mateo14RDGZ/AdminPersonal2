"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCalendarDue,
  IconClockExclamation,
  IconPigMoney,
  IconTargetArrow,
  IconWallet,
} from "@tabler/icons-react";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icon";
import {
  formatCurrency,
  formatTime,
  sourceLabel,
  monthKey,
} from "@/lib/format";
import type { TransactionWithCategory } from "@/lib/database.types";

type Summary = {
  month: string;
  totalIncome: number;
  fixedSavings: number;
  totalSpent: number;
  availableBudget: number;
  balances: {
    currency: string;
    income: number;
    savings: number;
    spent: number;
    available: number;
  }[];
  accountBalances: { currency: string; balance: number }[];
  pendingCount: number;
  primaryGoal: {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    currency: string;
    target_date: string | null;
  } | null;
  nextPayment: {
    merchant: string | null;
    description: string | null;
    amount: number;
    currency: string;
    next_execution_date: string;
  } | null;
  today: TransactionWithCategory[];
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

let dashboardCache: Summary | null = null;

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Cargando resumen">
      <div className="skeleton h-44 rounded-[26px]" />
      <div className="grid grid-cols-3 gap-2">
        <div className="skeleton h-24 rounded-[20px]" />
        <div className="skeleton h-24 rounded-[20px]" />
        <div className="skeleton h-24 rounded-[20px]" />
      </div>
      <div className="skeleton h-28 rounded-[20px]" />
    </div>
  );
}

export default function InicioPage() {
  const [summary, setSummary] = useState<Summary | null>(dashboardCache);
  const [loading, setLoading] = useState(!dashboardCache);

  const load = useCallback(async () => {
    if (!dashboardCache) setLoading(true);

    try {
      const response = await fetch(
        `/api/budgets/summary?month=${monthKey()}`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data = (await response.json()) as Summary;
      dashboardCache = data;
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("finance-data-changed", refresh);
    return () => window.removeEventListener("finance-data-changed", refresh);
  }, [load]);

  if (loading && !summary) return <DashboardSkeleton />;

  const withBudget =
    summary?.categories.filter((category) => category.budget != null) ?? [];
  const today = summary?.today ?? [];
  const available = summary?.availableBudget ?? 0;
  const balances = summary?.balances ?? [
    {
      currency: "UYU",
      income: summary?.totalIncome ?? 0,
      savings: summary?.fixedSavings ?? 0,
      spent: summary?.totalSpent ?? 0,
      available,
    },
  ];
  const primaryBalance =
    balances.find((balance) => balance.currency === "UYU") ?? balances[0];
  const secondaryBalances = balances.filter(
    (balance) =>
      balance.currency !== "UYU" &&
      (balance.income !== 0 || balance.savings !== 0 || balance.spent !== 0)
  );
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.max(
    1,
    Math.ceil((monthEnd.getTime() - now.getTime()) / 86_400_000)
  );
  const spendable = Math.max(0, primaryBalance?.available ?? available);
  const dailyAvailable = spendable / daysRemaining;
  const weeklyAvailable = Math.min(spendable, dailyAvailable * 7);
  const overBudgetCategory = summary?.categories.find(
    (category) => category.overBudget
  );
  const recommendation =
    (primaryBalance?.available ?? available) < 0
      ? "Tus compromisos superan el ingreso del mes. Revisá ahorros reservados y gastos próximos."
      : overBudgetCategory
        ? `Superaste el presupuesto de ${overBudgetCategory.name}. Conviene frenar gastos de esa categoría.`
        : summary?.pendingCount
          ? `Tenés ${summary.pendingCount} movimiento${summary.pendingCount === 1 ? "" : "s"} pendiente${summary.pendingCount === 1 ? "" : "s"} de confirmar.`
          : (primaryBalance?.savings ?? 0) > 0
            ? "Tu ahorro ya está separado del dinero disponible. Vas por buen camino."
            : "Definí una meta o un ahorro mensual para proteger parte de tus ingresos.";

  return (
    <div className="space-y-7 pb-5">
      <header className="page-enter">
        <p className="text-sm font-medium text-[var(--color-muted)]">
          Disponible este mes
        </p>
        <p
          className={`amount-xl mt-1 tabular-nums ${
            available < 0 ? "text-red-500" : ""
          }`}
        >
          {formatCurrency(primaryBalance?.available ?? available, "UYU")}
        </p>
      </header>

      <section className="page-enter-delay">
        <div className="finance-hero overflow-hidden rounded-[26px] p-5 text-white shadow-[0_18px_55px_-28px_rgba(5,70,54,0.85)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/70">Presupuesto total</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                {formatCurrency(primaryBalance?.income ?? 0, "UYU")}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <IconWallet size={24} stroke={1.8} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/10 px-3.5 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <IconPigMoney size={15} />
                Ahorro reservado
              </div>
              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrency(primaryBalance?.savings ?? 0, "UYU")}
              </p>
            </div>
            <div className="rounded-2xl bg-black/10 px-3.5 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <IconArrowDownRight size={15} />
                Gastado
              </div>
              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrency(primaryBalance?.spent ?? 0, "UYU")}
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/finanzas"
          className="pressable mt-3 flex items-center justify-between rounded-[18px] bg-[var(--color-surface-elevated)] px-4 py-3.5 shadow-sm"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IconArrowUpRight size={20} />
            </span>
            <span>
              <span className="block text-sm font-semibold">
                Ingresos y ahorros
              </span>
              <span className="block text-xs text-[var(--color-muted)]">
                Administrar tu presupuesto mensual
              </span>
            </span>
          </span>
          <span className="text-lg text-[var(--color-muted)]">›</span>
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="app-card p-4">
          <p className="text-xs text-[var(--color-muted)]">Por semana</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(weeklyAvailable, "UYU")}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            Aproximado
          </p>
        </div>
        <div className="app-card p-4">
          <p className="text-xs text-[var(--color-muted)]">Por día</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(dailyAvailable, "UYU")}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {daysRemaining} días restantes
          </p>
        </div>
      </section>

      {(summary?.accountBalances?.length ?? 0) > 0 ? (
        <section className="space-y-3">
          <h2 className="section-label">Saldo en cuentas</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {summary!.accountBalances.map((item) => (
              <div
                key={item.currency}
                className="app-card min-w-[145px] flex-1 p-4"
              >
                <p className="text-xs font-semibold text-[var(--color-muted)]">
                  {item.currency}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(item.balance, item.currency)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {summary?.primaryGoal || summary?.nextPayment || summary?.pendingCount ? (
        <section className="space-y-2">
          <h2 className="section-label">En foco</h2>
          {summary.primaryGoal ? (
            <Link
              href="/finanzas"
              className="pressable app-card flex min-h-16 items-center gap-3 px-4 py-3"
            >
              <IconTargetArrow className="text-[var(--color-accent)]" size={23} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {summary.primaryGoal.name}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {Math.min(
                    100,
                    Math.round(
                      (Number(summary.primaryGoal.current_amount) /
                        Number(summary.primaryGoal.target_amount)) *
                        100
                    )
                  )}
                  % de la meta
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(
                  Number(summary.primaryGoal.current_amount),
                  summary.primaryGoal.currency
                )}
              </span>
            </Link>
          ) : null}
          {summary.nextPayment ? (
            <div className="app-card flex min-h-16 items-center gap-3 px-4 py-3">
              <IconCalendarDue className="text-orange-500" size={23} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {summary.nextPayment.merchant ||
                    summary.nextPayment.description ||
                    "Próximo pago"}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {new Intl.DateTimeFormat("es-UY", {
                    day: "numeric",
                    month: "short",
                  }).format(
                    new Date(`${summary.nextPayment.next_execution_date}T12:00:00`)
                  )}
                </p>
              </div>
              <span className="text-sm font-semibold">
                {formatCurrency(
                  Number(summary.nextPayment.amount),
                  summary.nextPayment.currency
                )}
              </span>
            </div>
          ) : null}
          {summary.pendingCount > 0 ? (
            <div className="app-card flex min-h-16 items-center gap-3 px-4 py-3">
              <IconClockExclamation className="text-amber-500" size={23} />
              <p className="text-sm font-medium">
                {summary.pendingCount} movimiento
                {summary.pendingCount === 1 ? "" : "s"} pendiente
                {summary.pendingCount === 1 ? "" : "s"} de confirmar
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="app-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-label">Recomendación</h2>
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
            Sin IA
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed">{recommendation}</p>
      </section>

      {secondaryBalances.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-label">Otras monedas</h2>
            <span className="text-xs text-[var(--color-muted)]">
              Sin conversión
            </span>
          </div>
          <div className="space-y-2">
            {secondaryBalances.map((balance) => (
              <div
                key={balance.currency}
                className="app-card grid grid-cols-[1fr_auto] items-center gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-[var(--color-muted)]">
                    {balance.currency}
                  </p>
                  <p className="mt-1 text-sm">
                    Ahorro reservado{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(balance.savings, balance.currency)}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--color-muted)]">Disponible</p>
                  <p
                    className={`mt-1 font-semibold tabular-nums ${
                      balance.available < 0 ? "text-red-500" : ""
                    }`}
                  >
                    {formatCurrency(balance.available, balance.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {withBudget.length > 0 ? (
        <section className="space-y-3">
          <h2 className="section-label">Presupuestos por categoría</h2>
          <div className="space-y-3">
            {withBudget.map((category) => {
              const percentage =
                category.budget && category.budget > 0
                  ? Math.min(100, (category.spent / category.budget) * 100)
                  : 0;
              const barColor = category.overBudget
                ? "#F97316"
                : category.color;

              return (
                <div
                  key={category.category_id}
                  className="app-card content-auto p-4"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CategoryIcon
                        name={category.icon}
                        size={20}
                        color={category.color}
                      />
                      <span className="truncate font-medium">
                        {category.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--color-muted)]">
                      {formatCurrency(category.spent, "UYU")} /{" "}
                      {formatCurrency(category.budget ?? 0, "UYU")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="progress-bar h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: barColor,
                      }}
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
          <h2 className="section-label">Hoy</h2>
          <Link
            href="/movimientos"
            className="pressable text-sm font-medium text-[var(--color-accent)]"
          >
            Ver todo
          </Link>
        </div>
        {today.length === 0 ? (
          <EmptyState
            title="Nada por hoy"
            description="Cuando registres un gasto, aparecerá acá al instante."
            action={
              <Link
                href="/agregar"
                className="pressable inline-flex rounded-2xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Agregar gasto
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {today.map((transaction) => (
              <li
                key={transaction.id}
                className="app-card content-auto flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {transaction.merchant ||
                      transaction.categories?.name ||
                      "Gasto"}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {sourceLabel(transaction.source)} ·{" "}
                    {formatTime(transaction.occurred_at)}
                  </p>
                </div>
                <span className="amount-lg ml-3 shrink-0">
                  {formatCurrency(Number(transaction.amount), "UYU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
