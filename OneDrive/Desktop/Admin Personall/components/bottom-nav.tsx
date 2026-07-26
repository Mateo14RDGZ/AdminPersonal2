"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconChartBar,
  IconList,
  IconPigMoney,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";

const tabs = [
  { href: "/inicio", label: "Inicio", icon: IconChartBar },
  { href: "/movimientos", label: "Movimientos", icon: IconList },
  { href: "/agregar", label: "Agregar", icon: IconPlus, primary: true },
  { href: "/finanzas", label: "Finanzas", icon: IconPigMoney },
  { href: "/ajustes", label: "Ajustes", icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const tab of tabs) router.prefetch(tab.href);
  }, [router]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/92 shadow-[0_-12px_35px_-30px_rgba(0,0,0,0.45)] backdrop-blur-2xl safe-bottom"
      aria-label="Principal"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pb-1.5 pt-1.5">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;

          if (tab.primary) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch
                aria-label={tab.label}
                className="pressable -mt-6 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_10px_28px_-8px_rgba(29,158,117,0.7)]"
              >
                <Icon size={28} stroke={2.25} />
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              className={`pressable relative flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium ${
                active
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              {active ? (
                <span className="nav-active-pill absolute inset-x-2 inset-y-0 rounded-2xl bg-[var(--color-accent)]/8" />
              ) : null}
              <Icon
                className="relative"
                size={22}
                stroke={active ? 2.3 : 1.8}
              />
              <span className="relative truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
