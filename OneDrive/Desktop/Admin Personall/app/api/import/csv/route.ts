import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currencySchema, transactionTypeSchema } from "@/lib/validation";
import { databaseTransactionSource } from "@/lib/database-source";

const schema = z.object({
  fileName: z.string().trim().min(1).max(200),
  accountId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        occurredAt: z.string().datetime(),
        amount: z.coerce.number().positive(),
        currency: currencySchema,
        type: transactionTypeSchema.default("EXPENSE"),
        merchant: z.string().trim().max(500).optional().nullable(),
      })
    )
    .min(1)
    .max(500),
});

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: user.id,
      file_name: parsed.data.fileName,
      status: "PROCESSING",
      total_rows: parsed.data.rows.length,
    })
    .select("id")
    .single();
  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  let imported = 0;
  let duplicates = 0;
  let failed = 0;
  const service = createServiceClient();
  for (const [index, row] of parsed.data.rows.entries()) {
    const { data, error: rowError } = await service.rpc(
      "create_financial_transaction_service",
      {
        p_user_id: user.id,
        p_type: row.type,
        p_amount: row.amount,
        p_currency: row.currency,
        p_account_id: parsed.data.accountId,
        p_merchant: row.merchant ?? null,
        p_occurred_at: row.occurredAt,
        p_source: databaseTransactionSource("import"),
        p_status: "CONFIRMED",
        p_idempotency_key: `import:${batch.id}:${index}`,
      }
    );
    if (rowError) failed += 1;
    else if (data) imported += 1;
    else duplicates += 1;
  }

  await supabase
    .from("import_batches")
    .update({
      status: failed ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      imported_rows: imported,
      duplicate_rows: duplicates,
      error_rows: failed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .eq("user_id", user.id);

  return NextResponse.json({
    success: true,
    batchId: batch.id,
    imported,
    duplicates,
    failed,
  });
}
