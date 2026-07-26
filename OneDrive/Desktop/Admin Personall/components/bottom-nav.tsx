"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconList,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";

const tabs = [
  { href: "/inicio", label: "Inicio", icon: IconChartBar },
  { href: "/movimientos", label: "Movimientos", icon: IconList },
  { href: "/agregar", label: "Agregar", icon: IconPlus, primary: true },
  { href: "/ajustes", label: "Ajustes", icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/95 backdrop-blur-xl safe-bottom ios-transition"
      aria-label="Principal"
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-2 pb-2 pt-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          if (tab.primary) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg ios-transition active:scale-95"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                <Icon size={28} stroke={2.25} />
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ios-transition ${
                active ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
              }`}
            >
              <Icon size={24} stroke={active ? 2.25 : 1.75} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
