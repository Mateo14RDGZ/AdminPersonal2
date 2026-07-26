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
    .select("occurred_at, amount, merchant, note, card_name, source, categories(name)")
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
    merchant: string | null;
    note: string | null;
    card_name: string | null;
    source: string;
    categories: { name: string } | null;
  };

  const header = "fecha,monto,comercio,nota,tarjeta,origen,categoria\n";
  const rows = (data ?? []) as CsvRow[];
  const csvRows = rows.map((row) => {
    const cat = row.categories;
    return [
      row.occurred_at,
      String(row.amount),
      escapeCsv(row.merchant ?? ""),
      escapeCsv(row.note ?? ""),
      escapeCsv(row.card_name ?? ""),
      row.source,
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
