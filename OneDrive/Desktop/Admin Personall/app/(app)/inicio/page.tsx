"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconClockExclamation,
  IconChartLine,
  IconCircleCheck,
  IconPigMoney,
  IconPlus,
  IconWallet,
} from "@tabler/icons-react";
import { EmptyState } from "@/components/empty-state";
import { MoneyChat } from "@/components/money-chat";
import { formatCurrency, formatTime, monthKey, sourceLabel } from "@/lib/format";
import type { TransactionWithCategory } from "@/lib/database.types";
import { preloadAccounts } from "@/lib/accounts-client";

type Summary = {
  totalSpent: number;
  availableBudget: number;
  balances: { currency: string; income: number; savings: number; spent: number; available: number }[];
  accountBalances: { currency: string; balance: number }[];
  savingsAccountBalances: { currency: string; balance: number }[];
  pendingCount: number;
  pendingConfirmations: { id: string; raw_input: string; created_at: string }[];
  primaryGoal: { name: string; current_amount: number; target_amount: number; currency: string } | null;
  nextPayment: { merchant: string | null; description: string | null; amount: number; currency: string; next_execution_date: string } | null;
  categories: { category_id: string; name: string; budget: number | null; spent: number; previousSpent: number }[];
  today: TransactionWithCategory[];
};

let dashboardCache: Summary | null = null;

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Cargando resumen">
      <div className="skeleton h-44 rounded-[26px]" />
      <div className="grid grid-cols-2 gap-3">
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
      const response = await fetch(`/api/budgets/summary?month=${monthKey()}`, {
        cache: "no-store",
      });
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
    preloadAccounts();
    const refresh = () => void load();
    window.addEventListener("finance-data-changed", refresh);
    return () => window.removeEventListener("finance-data-changed", refresh);
  }, [load]);

  if (loading && !summary) return <DashboardSkeleton />;

  const accounts = summary?.accountBalances ?? [];
  const primaryAccount = accounts.find((account) => account.currency === "UYU") ?? null;
  const secondaryAccounts = accounts.filter((account) => account.currency !== "UYU");
  const savingsAccounts = summary?.savingsAccountBalances ?? [];
  const primarySavings = savingsAccounts.find((account) => account.currency === "UYU") ?? savingsAccounts[0];
  const budget = summary?.balances.find((item) => item.currency === "UYU") ?? summary?.balances[0];
  const today = summary?.today ?? [];
  const todaySpent = today.reduce((total, transaction) => transaction.type === "EXPENSE" && transaction.currency === "UYU" && transaction.status === "CONFIRMED" ? total + Number(transaction.amount) : total, 0);
  const primaryGoal = summary?.primaryGoal ?? null;
  const nextPayment = summary?.nextPayment ?? null;
  const categories = summary?.categories ?? [];
  const budgetLimit = categories.reduce((total, category) => total + (category.budget ?? 0), 0);
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const expectedSpend = budgetLimit > 0 ? budgetLimit * (dayOfMonth / daysInMonth) : 0;
  const trafficLight = budgetLimit > 0 && (budget?.spent ?? 0) > expectedSpend * 1.25
    ? { title: "Estás gastando demasiado", text: "Conviene controlar los gastos este mes.", tone: "red", icon: "🔴" }
    : budgetLimit > 0 && (budget?.spent ?? 0) > expectedSpend
      ? { title: "Vas un poco por encima", text: "Estás gastando un poco más de lo habitual.", tone: "amber", icon: "🟡" }
      : { title: "Vas excelente", text: budgetLimit > 0 ? "Vas dentro de tu presupuesto." : "Tus saldos están en orden.", tone: "emerald", icon: "🟢" };
  const goalProgress = primaryGoal && primaryGoal.target_amount > 0 ? Math.min(100, (Number(primaryGoal.current_amount) / Number(primaryGoal.target_amount)) * 100) : 0;
  const food = categories.find((category) => category.name.toLowerCase().includes("comida"));
  const topCategory = [...categories].sort((first, second) => second.spent - first.spent)[0];
  const insights = [
    food && food.previousSpent > 0 ? `Este mes gastaste ${Math.round(Math.abs((food.spent - food.previousSpent) / food.previousSpent) * 100)}% ${food.spent <= food.previousSpent ? "menos" : "más"} en comida.` : null,
    (budget?.spent ?? 0) > 0 ? `Tu gasto promedio diario es ${formatCurrency((budget?.spent ?? 0) / dayOfMonth, budget?.currency ?? "UYU")}.` : null,
    topCategory && topCategory.spent > 0 ? `${topCategory.name} es tu mayor gasto del mes: ${formatCurrency(topCategory.spent, "UYU")}.` : null,
  ].filter((insight): insight is string => Boolean(insight)).slice(0, 3);

  return (
    <div className="space-y-6 pb-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-muted)]">Tu dinero</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Resumen</h1>
        </div>
        <Link
          href="/agregar"
          className="pressable tap-target flex items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg shadow-black/20"
          aria-label="Registrar movimiento"
        >
          <IconPlus size={23} />
        </Link>
      </header>

      <section className="finance-hero overflow-hidden rounded-[26px] p-5 text-white shadow-[0_18px_55px_-28px_rgba(0,0,0,0.62)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-white/70">Saldo disponible en cuentas</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {primaryAccount
                ? formatCurrency(primaryAccount.balance, primaryAccount.currency)
                : formatCurrency(0, "UYU")}
            </p>
            <p className="mt-2 text-xs text-white/65">UYU · Bancos, efectivo y billeteras.</p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <IconWallet size={23} stroke={1.8} />
          </span>
        </div>
        <Link
          href="/ajustes"
          className="pressable mt-5 inline-flex rounded-xl bg-white/14 px-3 py-2 text-xs font-semibold backdrop-blur"
        >
          Ver y administrar cuentas
        </Link>
        {secondaryAccounts.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {secondaryAccounts.map((account) => (
              <span key={account.currency} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums">
                {account.currency} · {formatCurrency(account.balance, account.currency)}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className={`app-card flex items-center gap-3 border-l-4 p-4 ${trafficLight.tone === "red" ? "border-l-red-500" : trafficLight.tone === "amber" ? "border-l-amber-400" : "border-l-emerald-500"}`} aria-label="Estado financiero">
        <span className="text-xl" aria-hidden="true">{trafficLight.icon}</span>
        <div className="min-w-0"><p className="text-sm font-semibold">{trafficLight.title}</p><p className="mt-0.5 text-xs text-[var(--color-muted)]">{trafficLight.text}</p></div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><div><h2 className="section-label">Hoy</h2><p className="mt-1 text-xs text-[var(--color-muted)]">Lo importante de un vistazo</p></div><IconChartLine size={20} className="text-[var(--color-muted)]" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="app-card min-w-0 p-4"><p className="text-xs text-[var(--color-muted)]">Dinero disponible</p><p className="mt-1 truncate text-lg font-semibold tabular-nums">{formatCurrency(budget?.available ?? 0, budget?.currency ?? "UYU")}</p></div>
          <div className="app-card min-w-0 p-4"><p className="text-xs text-[var(--color-muted)]">Gastado hoy</p><p className="mt-1 truncate text-lg font-semibold tabular-nums">{formatCurrency(todaySpent, "UYU")}</p></div>
          <div className="app-card min-w-0 p-4"><p className="text-xs text-[var(--color-muted)]">Ahorrado este mes</p><p className="mt-1 truncate text-lg font-semibold tabular-nums">{formatCurrency(budget?.savings ?? 0, budget?.currency ?? "UYU")}</p></div>
          <div className="app-card min-w-0 p-4"><p className="text-xs text-[var(--color-muted)]">Próximo vencimiento</p>{nextPayment ? <><p className="mt-1 truncate text-sm font-semibold">{nextPayment.merchant ?? nextPayment.description ?? "Pago programado"}</p><p className="mt-0.5 text-xs text-[var(--color-muted)]">{new Date(`${nextPayment.next_execution_date}T12:00:00`).toLocaleDateString("es-UY", { day: "numeric", month: "short" })} · {formatCurrency(Number(nextPayment.amount), nextPayment.currency)}</p></> : <p className="mt-1 text-sm font-medium text-[var(--color-muted)]">Sin vencimientos</p>}</div>
          {primaryGoal ? <div className="app-card col-span-2 p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-[var(--color-muted)]">Meta principal</p><p className="mt-1 truncate text-sm font-semibold">{primaryGoal.name}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{Math.round(goalProgress)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-border)]"><div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-700" style={{ width: `${goalProgress}%` }} /></div><p className="mt-2 text-xs text-[var(--color-muted)]">{formatCurrency(Number(primaryGoal.current_amount), primaryGoal.currency)} de {formatCurrency(Number(primaryGoal.target_amount), primaryGoal.currency)}</p></div> : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link href="/finanzas" className="pressable app-card min-w-0 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <IconArrowUpRight size={19} />
          </span>
          <p className="mt-3 text-xs text-[var(--color-muted)]">Disponible en cuentas</p>
          <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${(budget?.available ?? 0) < 0 ? "text-red-500" : ""}`}>
            {formatCurrency(budget?.available ?? 0, budget?.currency ?? "UYU")}
          </p>
        </Link>
        <Link href="/finanzas" className="pressable app-card min-w-0 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <IconPigMoney size={19} />
          </span>
          <p className="mt-3 text-xs text-[var(--color-muted)]">Ahorro reservado</p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums">
            {formatCurrency(primarySavings?.balance ?? 0, primarySavings?.currency ?? "UYU")}
          </p>
        </Link>
      </section>

      <MoneyChat onRegistered={() => void load()} />

      {insights.length > 0 ? <section className="space-y-3"><h2 className="section-label">En breve</h2><div className="space-y-2">{insights.map((insight) => <div key={insight} className="app-card flex items-start gap-3 px-4 py-3"><IconCircleCheck size={18} className="mt-0.5 shrink-0 text-[var(--color-accent)]" /><p className="text-sm leading-relaxed text-[var(--color-muted)]">{insight}</p></div>)}</div></section> : null}

      {accounts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Saldos por moneda</h2>
            <Link href="/ajustes" className="text-sm font-medium text-[var(--color-accent)]">Cuentas</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {accounts.map((account) => (
              <div key={account.currency} className="app-card min-w-0 p-4">
                <p className="text-xs font-semibold text-[var(--color-muted)]">{account.currency}</p>
                <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${account.balance < 0 ? "text-red-500" : ""}`}>
                  {formatCurrency(account.balance, account.currency)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {summary?.pendingCount ? (
        <Link
          href={`/confirmar/${summary.pendingConfirmations[0]?.id ?? ""}`}
          className="pressable app-card flex min-h-16 items-center gap-3 px-4 py-3"
        >
          <IconClockExclamation className="text-amber-500" size={23} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Tenés {summary.pendingCount} movimiento pendiente</p>
            <p className="truncate text-xs text-[var(--color-muted)]">{summary.pendingConfirmations[0]?.raw_input}</p>
          </div>
          <span className="text-sm font-semibold text-[var(--color-accent)]">Revisar</span>
        </Link>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Últimos movimientos</h2>
          <Link href="/movimientos" className="text-sm font-medium text-[var(--color-accent)]">Ver todo</Link>
        </div>
        {today.length === 0 ? (
          <EmptyState
            title="Todavía no registraste movimientos hoy"
            description="Tocá + para registrar un gasto, ingreso o transferencia."
            action={<Link href="/agregar" className="pressable inline-flex rounded-2xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white">Registrar movimiento</Link>}
          />
        ) : (
          <ul className="space-y-2">
            {today.slice(0, 5).map((transaction) => (
              <li key={transaction.id} className="app-card flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {transaction.merchant ||
                      transaction.categories?.name ||
                      (transaction.type === "INCOME"
                        ? "Ingreso"
                        : transaction.type === "TRANSFER"
                          ? "Transferencia"
                          : transaction.type === "REFUND"
                            ? "Devolución"
                            : "Gasto")}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{sourceLabel(transaction.source)} · {formatTime(transaction.occurred_at)}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(Number(transaction.amount), transaction.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
