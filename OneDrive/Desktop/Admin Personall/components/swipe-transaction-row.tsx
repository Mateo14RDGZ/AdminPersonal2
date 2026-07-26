"use client";

import { useRef, useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { formatCurrency, formatTime, sourceLabel } from "@/lib/format";
import type { TransactionWithCategory } from "@/lib/database.types";

type Props = {
  transaction: TransactionWithCategory;
  onDelete: (id: string) => Promise<void>;
  onEdit: (transaction: TransactionWithCategory) => void;
};

const REVEAL_POINT = -52;
const OPEN_OFFSET = -88;
const DELETE_POINT = -108;

export function SwipeTransactionRow({
  transaction,
  onDelete,
  onEdit,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startingOffset = useRef(0);
  const horizontalGesture = useRef<boolean | null>(null);
  const thresholdHapticSent = useRef(false);

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    setOffset(-Math.max(window.innerWidth, 520));
    navigator.vibrate?.(12);
    await new Promise((resolve) => window.setTimeout(resolve, 190));

    try {
      await onDelete(transaction.id);
    } catch {
      setRemoving(false);
      setOffset(0);
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (removing) return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    startingOffset.current = offset;
    horizontalGesture.current = null;
    thresholdHapticSent.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || removing) return;
    const deltaX = event.clientX - startX.current;
    const deltaY = event.clientY - startY.current;

    if (horizontalGesture.current === null) {
      if (Math.abs(deltaX) < 7 && Math.abs(deltaY) < 7) return;
      horizontalGesture.current = Math.abs(deltaX) > Math.abs(deltaY);
    }
    if (!horizontalGesture.current) return;

    const nextOffset = startingOffset.current + deltaX;
    const resistedOffset =
      nextOffset > 0
        ? Math.min(0, nextOffset * 0.12)
        : Math.max(-150, nextOffset);
    setOffset(resistedOffset);

    if (resistedOffset <= DELETE_POINT && !thresholdHapticSent.current) {
      thresholdHapticSent.current = true;
      navigator.vibrate?.(8);
    } else if (
      resistedOffset > DELETE_POINT &&
      thresholdHapticSent.current
    ) {
      thresholdHapticSent.current = false;
    }
  };

  const finishGesture = () => {
    if (!dragging) return;
    setDragging(false);

    if (horizontalGesture.current && offset <= DELETE_POINT) {
      void remove();
      return;
    }

    setOffset(
      horizontalGesture.current && offset <= REVEAL_POINT ? OPEN_OFFSET : 0
    );
  };

  const category = transaction.categories;
  const secondary = `${sourceLabel(transaction.source)} · ${formatTime(
    transaction.occurred_at
  )} · ${transaction.currency}`;
  const isPositive = ["INCOME", "REFUND", "LOAN_RECEIVED"].includes(
    transaction.type
  );

  return (
    <div className="swipe-row relative overflow-hidden rounded-[18px]">
      <button
        type="button"
        onClick={() => void remove()}
        className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-1 bg-red-500 text-xs font-semibold text-white"
        aria-label={`Eliminar ${
          transaction.merchant || transaction.note || "gasto"
        }`}
      >
        <IconTrash size={22} stroke={2} />
        Eliminar
      </button>
      <div
        className={`relative flex select-none items-center gap-3 bg-[var(--color-surface-elevated)] px-4 py-3 ${
          dragging ? "" : "swipe-spring"
        } ${removing ? "pointer-events-none" : ""}`}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          touchAction: "pan-y",
          willChange: offset === 0 ? "auto" : "transform",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onDoubleClick={() => onEdit(transaction)}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${category?.color ?? "#6B7280"}22` }}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: category?.color ?? "#6B7280" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {transaction.merchant ||
              transaction.note ||
              category?.name ||
              "Sin descripción"}
          </p>
          <p className="text-xs text-[var(--color-muted)]">{secondary}</p>
        </div>
        <p
          className={`amount-lg shrink-0 ${
            isPositive ? "text-emerald-500" : ""
          }`}
        >
          {isPositive ? "+" : transaction.type === "TRANSFER" ? "" : "−"}
          {formatCurrency(Number(transaction.amount), transaction.currency)}
        </p>
      </div>
    </div>
  );
}
