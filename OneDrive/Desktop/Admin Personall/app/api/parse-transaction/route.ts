import { NextRequest, NextResponse } from "next/server";
import { authenticateAutomationToken } from "@/lib/automation-auth";
import { requireUser } from "@/lib/api-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { transactionParser, normalizeText } from "@/lib/transaction-parser";
import { parseTransactionSchema } from "@/lib/validation";
import { formatCurrency } from "@/lib/format";

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsedBody = parseTransactionSchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const bearer = request.headers.get("authorization")?.startsWith("Bearer ");
  const automation = bearer
    ? await authenticateAutomationToken(request)
    : null;
  let userId: string;
  let supabase;

  if (bearer) {
    if (!automation) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
    userId = automation.userId;
    supabase = automation.supabase;
  } else {
    const session = await requireUser();
    if (session.error) return session.error;
    userId = session.user.id;
    supabase = await createClient();
  }

  const limitKey = rateLimitKey(
    request,
    automation?.tokenId ?? userId.slice(0, 8)
  );
  if (!checkRateLimit(limitKey)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const interpretation = await transactionParser.parse(parsedBody.data);
  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,institution,currency,is_default")
      .eq("user_id", userId)
      .eq("is_archived", false),
    supabase
      .from("categories")
      .select("id,name")
      .eq("user_id", userId),
  ]);

  const currencyAccounts = (accounts ?? []).filter(
    (account) => account.currency === interpretation.currency
  );
  const hint = interpretation.accountHint
    ? normalizeText(interpretation.accountHint)
    : "";
  const account =
    (parsedBody.data.defaultAccountId
      ? currencyAccounts.find(
          (candidate) => candidate.id === parsedBody.data.defaultAccountId
        )
      : null) ??
    (hint
      ? currencyAccounts.find((candidate) =>
          normalizeText(
            `${candidate.name} ${candidate.institution ?? ""}`
          ).includes(hint)
        )
      : null) ??
    currencyAccounts.find((candidate) => candidate.is_default) ??
    (currencyAccounts.length === 1 ? currencyAccounts[0] : null);

  const destinationHint = interpretation.destinationAccountHint
    ? normalizeText(interpretation.destinationAccountHint)
    : "";
  const destinationAccount = destinationHint
    ? currencyAccounts.find((candidate) =>
        normalizeText(`${candidate.name} ${candidate.institution ?? ""}`).includes(
          destinationHint
        )
      )
    : null;
  const category = interpretation.categoryHint
    ? (categories ?? []).find(
        (candidate) =>
          normalizeText(candidate.name) ===
          normalizeText(interpretation.categoryHint!)
      )
    : null;

  const requiresConfirmation =
    !interpretation.amount ||
    !account ||
    (interpretation.type === "TRANSFER" && !destinationAccount) ||
    interpretation.confidence < 0.85;

  const payload = {
    ...interpretation,
    accountId: account?.id ?? null,
    destinationAccountId: destinationAccount?.id ?? null,
    categoryId: category?.id ?? null,
  };

  if (parsedBody.data.dryRun) {
    return NextResponse.json({
      success: true,
      requiresConfirmation,
      transaction: payload,
      message: requiresConfirmation
        ? "Revisá los datos antes de guardar"
        : "Movimiento listo para guardar",
    });
  }

  if (requiresConfirmation) {
    const { data: pending, error } = await supabase
      .from("pending_transaction_confirmations")
      .insert({
        user_id: userId,
        raw_input: interpretation.rawInput,
        parsed_payload: payload,
        source: interpretation.source,
      })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const baseUrl =
      process.env.APP_BASE_URL ?? request.nextUrl.origin;
    return NextResponse.json({
      success: true,
      requiresConfirmation: true,
      transaction: payload,
      confirmationId: pending.id,
      confirmationUrl: `${baseUrl}/confirmar/${pending.id}`,
      message: "Necesito que confirmes algunos datos",
    });
  }

  const rpcArgs = {
    p_type: interpretation.type,
    p_amount: interpretation.amount!,
    p_currency: interpretation.currency,
    p_account_id: account!.id,
    p_destination_account_id: destinationAccount?.id ?? null,
    p_category_id: category?.id ?? null,
    p_merchant: interpretation.merchant,
    p_description: interpretation.description,
    p_occurred_at: interpretation.occurredAt,
    p_source: interpretation.source,
    p_status: "CONFIRMED",
    p_idempotency_key: parsedBody.data.idempotencyKey ?? null,
    p_confidence: interpretation.confidence,
    p_raw_input: interpretation.rawInput,
  };
  const { data: transaction, error: createError } = bearer
    ? await supabase.rpc("create_financial_transaction_service", {
        p_user_id: userId,
        ...rpcArgs,
      })
    : await supabase.rpc("create_financial_transaction", rpcArgs);

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  const label =
    interpretation.type === "INCOME"
      ? "Ingreso"
      : interpretation.type === "TRANSFER"
        ? "Transferencia"
        : interpretation.type === "REFUND"
          ? "Devolución"
          : "Gasto";
  return NextResponse.json({
    success: true,
    requiresConfirmation: false,
    transaction,
    message: `${label} de ${formatCurrency(
      interpretation.amount!,
      interpretation.currency
    )} registrado${interpretation.merchant ? ` en ${interpretation.merchant}` : ""}`,
  });
}

