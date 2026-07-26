"use client";

import { useRef, useState } from "react";
import { formatCurrency, formatTime, sourceLabel } from "@/lib/format";
import type { TransactionWithCategory } from "@/lib/database.types";

type Props = {
  transaction: TransactionWithCategory;
  onDelete: (id: string) => void;
  onEdit: (tx: TransactionWithCategory) => void;
};

export function SwipeTransactionRow({ transaction, onDelete, onEdit }: Props) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    setOffset(Math.max(-120, Math.min(120, dx)));
  };

  const onTouchEnd = () => {
    dragging.current = false;
    if (offset <= -80) onDelete(transaction.id);
    else if (offset >= 80) onEdit(transaction);
    setOffset(0);
  };

  const cat = transaction.categories;
  const secondary = `${sourceLabel(transaction.source)} · ${formatTime(transaction.occurred_at)}`;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-[var(--color-accent)] text-sm font-medium text-white">
        Editar
      </div>
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-red-500 text-sm font-medium text-white">
        Borrar
      </div>
      <div
        className="relative flex items-center gap-3 bg-[var(--color-surface-elevated)] px-4 py-3 ios-transition"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${cat?.color ?? "#6B7280"}22` }}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: cat?.color ?? "#6B7280" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {transaction.merchant || transaction.note || cat?.name || "Sin descripción"}
          </p>
          <p className="text-xs text-[var(--color-muted)]">{secondary}</p>
        </div>
        <p className="amount-lg shrink-0">{formatCurrency(Number(transaction.amount))}</p>
      </div>
    </div>
  );
}
