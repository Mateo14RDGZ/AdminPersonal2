"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryIcon, CATEGORY_ICON_OPTIONS } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import { createClient } from "@/lib/supabase/client";
import type { Category, MerchantRule } from "@/lib/database.types";
import { AccountsSection } from "@/components/accounts-section";
import { AutomationSection } from "@/components/automation-section";
import { CardsSection } from "@/components/cards-section";
import { ImportSection } from "@/components/import-section";

export default function AjustesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<(MerchantRule & { categories?: Category | null })[]>([]);
  const [pushMsg, setPushMsg] = useState("");
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [newRule, setNewRule] = useState({ pattern: "", category_id: "" });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cats }, { data: rls }] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("merchant_rules").select("*, categories(*)").order("created_at"),
    ]);
    setCategories(cats ?? []);
    setRules((rls as unknown as typeof rules) ?? []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveCategory = async () => {
    if (!editing?.name) return;
    const supabase = createClient();
    const payload = {
      name: editing.name,
      icon: editing.icon ?? "category",
      color: editing.color ?? "#6B7280",
      monthly_budget: editing.monthly_budget ?? null,
    };
    if (editing.id) {
      await supabase.from("categories").update(payload).eq("id", editing.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("categories").insert({ ...payload, user_id: user.id });
    }
    setEditing(null);
    await reload();
  };

  const deleteCategory = async (id: string) => {
    const supabase = createClient();
    await supabase.from("categories").delete().eq("id", id);
    await reload();
  };

  const addRule = async () => {
    if (!newRule.pattern || !newRule.category_id) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("merchant_rules").insert({
      user_id: user.id,
      pattern: newRule.pattern,
      category_id: newRule.category_id,
    });
    setNewRule({ pattern: "", category_id: "" });
    await reload();
  };

  const deleteRule = async (id: string) => {
    const supabase = createClient();
    await supabase.from("merchant_rules").delete().eq("id", id);
    await reload();
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const enablePush = async () => {
    const result = await subscribeToPush();
    setPushMsg(result.message);
  };

  return (
    <div className="space-y-8 pb-4">
      <h1 className="text-xl font-semibold">Ajustes</h1>

      <AccountsSection />

      <CardsSection />

      <AutomationSection />

      <ImportSection />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">Categorías</h2>
          <button
            type="button"
            onClick={() =>
              setEditing({
                name: "",
                icon: "category",
                color: "#1D9E75",
                monthly_budget: null,
              })
            }
            className="text-sm text-[var(--color-accent)]"
          >
            Nueva
          </button>
        </div>
        {categories.length === 0 ? (
          <EmptyState
            title="Sin categorías"
            description="Creá categorías para organizar tus gastos."
          />
        ) : (
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between rounded-[18px] bg-[var(--color-surface-elevated)] px-4 py-3"
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => setEditing(cat)}
                >
                  <CategoryIcon name={cat.icon} color={cat.color} />
                  <div>
                    <p className="font-medium">{cat.name}</p>
                    {cat.monthly_budget != null ? (
                      <p className="text-xs text-[var(--color-muted)]">
                        Presupuesto: ${Number(cat.monthly_budget).toLocaleString("es-AR")}
                      </p>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteCategory(cat.id)}
                  className="text-xs text-red-500"
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--color-muted)]">Reglas de comercio</h2>
        <div className="space-y-2 rounded-[18px] bg-[var(--color-surface-elevated)] p-4">
          <input
            value={newRule.pattern}
            onChange={(e) => setNewRule((r) => ({ ...r, pattern: e.target.value }))}
            placeholder="Texto o /regex/"
            className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
          <select
            value={newRule.category_id}
            onChange={(e) => setNewRule((r) => ({ ...r, category_id: e.target.value }))}
            className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            <option value="">Categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void addRule()}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            Agregar regla
          </button>
        </div>
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between rounded-2xl bg-[var(--color-surface-elevated)] px-4 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{rule.pattern}</span>
                <span className="text-[var(--color-muted)]">
                  {" "}
                  → {rule.categories?.name ?? "?"}
                </span>
              </span>
              <button type="button" onClick={() => void deleteRule(rule.id)} className="text-red-500">
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-[18px] bg-[var(--color-surface-elevated)] p-4">
        <h2 className="text-sm font-medium">Notificaciones</h2>
        <p className="text-xs text-[var(--color-muted)]">
          Avisos cuando llegue un gasto desde Atajos de iOS.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void enablePush()}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            Activar push
          </button>
          <button
            type="button"
            onClick={() => void unsubscribeFromPush().then(() => setPushMsg("Suscripción eliminada."))}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
          >
            Desactivar
          </button>
        </div>
        {pushMsg ? <p className="text-xs text-[var(--color-muted)]">{pushMsg}</p> : null}
      </section>

      <section className="space-y-2">
        <a
          href="/api/export/csv"
          className="block rounded-[18px] bg-[var(--color-surface-elevated)] px-4 py-3 text-center text-sm font-medium"
        >
          Exportar CSV
        </a>
        <a
          href="/api/export/json"
          className="block rounded-[18px] bg-[var(--color-surface-elevated)] px-4 py-3 text-center text-sm font-medium"
        >
          Exportar copia completa JSON
        </a>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-[18px] border border-[var(--color-border)] py-3 text-sm font-medium text-red-500"
        >
          Cerrar sesión
        </button>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/40 p-4 safe-bottom">
          <div className="w-full max-w-lg rounded-[20px] bg-[var(--color-surface-elevated)] p-5">
            <h3 className="font-semibold">{editing.id ? "Editar" : "Nueva"} categoría</h3>
            <div className="mt-3 space-y-3">
              <input
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nombre"
                className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2.5"
              />
              <select
                value={editing.icon ?? "category"}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2.5"
              >
                {CATEGORY_ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
              <input
                type="color"
                value={editing.color ?? "#1D9E75"}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                className="h-10 w-full"
              />
              <input
                type="number"
                min={0}
                value={editing.monthly_budget ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    monthly_budget: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Presupuesto mensual (opcional)"
                className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2.5"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl py-2.5">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveCategory()}
                className="flex-1 rounded-xl py-2.5 font-medium text-white"
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
