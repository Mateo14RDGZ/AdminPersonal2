"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SwipeTransactionRow } from "@/components/swipe-transaction-row";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { formatDayHeader } from "@/lib/format";
import type { Category, TransactionWithCategory } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

export default function MovimientosPage() {
  const [items, setItems] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (q.trim()) params.set("q", q.trim());
    if (categoryFilter) params.set("category", categoryFilter);
    const res = await fetch(`/api/transactions?${params}`);
    if (res.ok) {
      const json = await res.json();
      setItems(json.data ?? []);
    }
    setLoading(false);
  }, [q, categoryFilter]);

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
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    setItems((list) => list.filter((t) => t.id !== id));
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
      <h1 className="text-xl font-semibold">Movimientos</h1>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar comercio"
          className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-base outline-none"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="max-w-[40%] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm"
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
        <p className="text-sm text-[var(--color-muted)]">Cargando…</p>
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

      {editId ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/40 p-4 safe-bottom">
          <div className="w-full max-w-lg rounded-[20px] bg-[var(--color-surface-elevated)] p-5">
            <h3 className="font-semibold">Recategorizar</h3>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
