"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { IconFileImport } from "@tabler/icons-react";
import type { Account } from "@/lib/database.types";

type PreviewRow = {
  occurredAt: string;
  merchant: string;
  amount: number;
  currency: string;
  type: "EXPENSE" | "INCOME";
};

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if ((character === "," || character === "\t" || character === ";") && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

export function ImportSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/accounts", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Account[]) => {
        setAccounts(data);
        setAccountId(data[0]?.id ?? "");
      });
  }, []);

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|tsv|txt)$/i.test(file.name) || file.size > 2_000_000) {
      setMessage("Usá un CSV, TSV o TXT de hasta 2 MB.");
      return;
    }
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2 || lines.length > 501) {
      setMessage("El archivo debe tener encabezado y hasta 500 movimientos.");
      return;
    }
    const headers = splitCsvLine(lines[0]).map((header) =>
      header.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    );
    const findIndex = (...names: string[]) =>
      headers.findIndex((header) => names.includes(header));
    const dateIndex = findIndex("fecha", "date", "occurred_at");
    const descriptionIndex = findIndex("descripcion", "comercio", "merchant", "concepto");
    const amountIndex = findIndex("monto", "importe", "amount");
    const currencyIndex = findIndex("moneda", "currency");
    const typeIndex = findIndex("tipo", "type");
    if (dateIndex < 0 || amountIndex < 0) {
      setMessage("El archivo necesita columnas fecha y monto.");
      return;
    }
    const parsedRows = lines.slice(1).map(splitCsvLine).flatMap((values) => {
      const amount = Number(
        (values[amountIndex] ?? "").replace(/\s/g, "").replace(",", ".")
      );
      const date = new Date(values[dateIndex]);
      if (!Number.isFinite(amount) || amount === 0 || Number.isNaN(date.getTime()))
        return [];
      const rawType = (values[typeIndex] ?? "").toLowerCase();
      return [{
        occurredAt: date.toISOString(),
        merchant: values[descriptionIndex] ?? "",
        amount: Math.abs(amount),
        currency: (values[currencyIndex] || "UYU").toUpperCase(),
        type: (amount < 0 || /gasto|debito/.test(rawType)
          ? "EXPENSE"
          : /ingreso|credito/.test(rawType)
            ? "INCOME"
            : "EXPENSE") as "EXPENSE" | "INCOME",
      }];
    });
    setFileName(file.name);
    setRows(parsedRows);
    setMessage(`${parsedRows.length} movimientos listos para revisar.`);
  };

  const importRows = async () => {
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account || rows.some((row) => row.currency !== account.currency)) {
      setMessage("La moneda de todas las filas debe coincidir con la cuenta.");
      return;
    }
    const response = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, accountId, rows }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage("No se pudo importar el archivo.");
      return;
    }
    setMessage(`${result.imported} importados · ${result.failed} con error.`);
    setRows([]);
    window.dispatchEvent(new Event("finance-data-changed"));
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-label">Importar movimientos</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          CSV, TSV o texto delimitado con vista previa
        </p>
      </div>
      <div className="app-card space-y-3 p-4">
        <label className="pressable flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] text-sm font-medium">
          <IconFileImport size={20} />
          Elegir archivo
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={(event) => void readFile(event)} className="sr-only" />
        </label>
        {rows.length ? (
          <>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="app-input">
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-[var(--color-border)]">
              {rows.slice(0, 20).map((row, index) => (
                <div key={`${row.occurredAt}-${index}`} className="flex justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2 text-xs last:border-0">
                  <span className="truncate">{row.merchant || "Sin descripción"}</span>
                  <span className="shrink-0 tabular-nums">{row.currency} {row.amount}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void importRows()} className="pressable min-h-12 w-full rounded-2xl bg-[var(--color-accent)] text-sm font-semibold text-white">
              Importar {rows.length} movimientos
            </button>
          </>
        ) : null}
        {message ? <p className="text-xs text-[var(--color-muted)]">{message}</p> : null}
      </div>
    </section>
  );
}

