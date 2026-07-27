"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  { href: "/finanzas", label: "Metas", icon: IconPigMoney },
  { href: "/ajustes", label: "Ajustes", icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.href === pathname));
  const [liquidIndex, setLiquidIndex] = useState(activeIndex);

  useEffect(() => {
    for (const tab of tabs) router.prefetch(tab.href);
  }, [router]);

  useEffect(() => setLiquidIndex(activeIndex), [activeIndex]);

  const indexAt = (clientX: number) => {
    const bounds = navRef.current?.getBoundingClientRect();
    if (!bounds) return activeIndex;
    return Math.max(0, Math.min(tabs.length - 1, Math.floor(((clientX - bounds.left) / bounds.width) * tabs.length)));
  };
  const positionAt = (clientX: number) => {
    const bounds = navRef.current?.getBoundingClientRect();
    if (!bounds) return activeIndex;
    return Math.max(0, Math.min(tabs.length - 1, ((clientX - bounds.left) / bounds.width) * tabs.length - 0.5));
  };

  const finishLiquidDrag = (clientX: number) => {
    if (!dragging) return;
    const next = indexAt(clientX);
    setDragging(false);
    setLiquidIndex(next);
    if (next !== activeIndex) router.push(tabs[next].href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-3 safe-bottom"
      aria-label="Principal"
    >
      <div
        ref={navRef}
        className="liquid-nav mx-auto grid w-full max-w-[450px] grid-cols-5 items-end rounded-[24px] border border-[var(--color-border)] px-1 pb-1.5 pt-1.5"
        onPointerDown={(event) => { if (event.pointerType === "touch") { setDragging(true); setLiquidIndex(positionAt(event.clientX)); } }}
        onPointerMove={(event) => { if (dragging) setLiquidIndex(positionAt(event.clientX)); }}
        onPointerUp={(event) => finishLiquidDrag(event.clientX)}
        onPointerCancel={() => { setDragging(false); setLiquidIndex(activeIndex); }}
      >
        <span
          className={`liquid-selector ${dragging ? "liquid-selector-dragging" : ""}`}
          style={{ "--liquid-index": liquidIndex } as CSSProperties}
          aria-hidden="true"
        />
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
                className="pressable -mt-7 mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-[21px] bg-[var(--color-accent)] text-white shadow-[0_14px_30px_-10px_rgba(217,100,61,.8)]"
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
              className={`pressable relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[11px] font-medium ${
                active
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
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
