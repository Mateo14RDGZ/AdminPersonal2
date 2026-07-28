"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SwipeTransactionRow } from "@/components/swipe-transaction-row";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { formatDayHeader } from "@/lib/format";
import type { Category, TransactionWithCategory } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "@/components/app-motion";

export default function MovimientosPage() {
  const [items, setItems] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (categoryFilter) params.set("category", categoryFilter);
    const res = await fetch(`/api/transactions?${params}`);
    if (res.ok) {
      const json = await res.json();
      setItems(json.data ?? []);
    }
    loadedOnce.current = true;
    setLoading(false);
  }, [debouncedQ, categoryFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQ(q), 220);
    return () => window.clearTimeout(timeout);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    void supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, TransactionWithCategory[]>();
    for (const tx of items) {
      const key = new Date(tx.occurred_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return [...map.entries()];
  }, [items]);

  const onDelete = async (id: string) => {
    const previous = items;
    setItems((list) => list.filter((transaction) => transaction.id !== id));
    const response = await fetch(`/api/transactions/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setItems(previous);
      throw new Error("No se pudo eliminar el gasto");
    }
    window.dispatchEvent(new Event("finance-data-changed"));
  };

  const onEdit = (tx: TransactionWithCategory) => {
    setEditId(tx.id);
    setEditCategory(tx.category_id ?? "");
  };

  const saveEdit = async () => {
    if (!editId) return;
    const res = await fetch(`/api/transactions/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: editCategory || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((list) => list.map((t) => (t.id === editId ? updated : t)));
    }
    setEditId(null);
  };

  return (
    <div className="space-y-4 pb-4">
      <header>
        <p className="text-sm font-medium text-[var(--color-muted)]">Historial</p>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
      </header>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar comercio"
          className="app-input min-w-0 flex-1 bg-[var(--color-surface-elevated)] py-2.5"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="max-w-[40%] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm outline-none"
        >
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-16 rounded-[18px]" />
          <div className="skeleton h-16 rounded-[18px]" />
          <div className="skeleton h-16 rounded-[18px]" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          description="Tus gastos manuales y automáticos van a aparecer acá."
          action={
            <Link
              href="/agregar"
              className="inline-flex rounded-2xl px-5 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              Registrar el primero
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, txs]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-sm font-medium capitalize text-[var(--color-muted)]">
                {formatDayHeader(txs[0].occurred_at)}
              </h2>
              <ul className="space-y-2">
                {txs.map((tx) => (
                  <li key={tx.id}>
                    <SwipeTransactionRow
                      transaction={tx}
                      onDelete={onDelete}
                      onEdit={onEdit}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <BottomSheet open={Boolean(editId)} labelledBy="recategorize-sheet-title">
            <h3 id="recategorize-sheet-title" className="font-semibold">Recategorizar</h3>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="mt-3 w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2.5"
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="flex-1 rounded-xl py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                Guardar
              </button>
            </div>
      </BottomSheet>
    </div>
  );
}
