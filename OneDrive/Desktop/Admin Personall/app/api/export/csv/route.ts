import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("occurred_at, type, amount, currency, merchant, note, card_name, source, status, categories(name)")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false });

  if (from) query = query.gte("occurred_at", from);
  if (to) query = query.lte("occurred_at", to);

  const { data, error: dbError } = await query;
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  type CsvRow = {
    occurred_at: string;
    amount: number;
    type: string;
    currency: string;
    merchant: string | null;
    note: string | null;
    card_name: string | null;
    source: string;
    status: string;
    categories: { name: string } | null;
  };

  const header = "fecha,tipo,monto,moneda,comercio,nota,tarjeta,origen,estado,categoria\n";
  const rows = (data ?? []) as unknown as CsvRow[];
  const csvRows = rows.map((row) => {
    const cat = row.categories;
    return [
      row.occurred_at,
      row.type,
      String(row.amount),
      row.currency,
      escapeCsv(row.merchant ?? ""),
      escapeCsv(row.note ?? ""),
      escapeCsv(row.card_name ?? ""),
      row.source,
      row.status,
      escapeCsv(cat?.name ?? ""),
    ].join(",");
  });

  const csv = header + csvRows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="movimientos.csv"',
    },
  });
}
