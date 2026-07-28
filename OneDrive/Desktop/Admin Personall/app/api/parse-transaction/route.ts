import { NextRequest, NextResponse } from "next/server";
import { authenticateAutomationToken } from "@/lib/automation-auth";
import { requireUser } from "@/lib/api-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { transactionParser, normalizeText } from "@/lib/transaction-parser";
import { parseTransactionSchema } from "@/lib/validation";
import { formatCurrency } from "@/lib/format";
import { databaseTransactionSource } from "@/lib/database-source";
import { sendPushToUser } from "@/lib/push-server";
import { matchCategoryFromRules } from "@/lib/categorize";
import { verifySavedTransactionAccount } from "@/lib/account-balance-reconciliation";

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
  const [{ data: accounts }, { data: categories }, { data: merchantRules }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,institution,type,currency,is_default")
      .eq("user_id", userId)
      .eq("is_archived", false),
    supabase
      .from("categories")
      .select("id,name")
      .eq("user_id", userId),
    supabase
      .from("merchant_rules")
      .select("*")
      .eq("user_id", userId),
  ]);

  const selectedAccount = parsedBody.data.defaultAccountId
    ? (accounts ?? []).find((candidate) => candidate.id === parsedBody.data.defaultAccountId) ?? null
    : null;
  if (parsedBody.data.defaultAccountId && !selectedAccount) {
    return NextResponse.json({ error: "La cuenta seleccionada ya no está disponible." }, { status: 409 });
  }
  if (selectedAccount && selectedAccount.currency !== interpretation.currency) {
    return NextResponse.json({ error: `La cuenta seleccionada usa ${selectedAccount.currency}, pero el movimiento está en ${interpretation.currency}.` }, { status: 409 });
  }

  const currencyAccounts = (accounts ?? []).filter(
    (account) => account.currency === interpretation.currency
  );
  const hint = interpretation.accountHint
    ? normalizeText(interpretation.accountHint)
    : "";
  const isCashHint = /^(efectivo|cash|billetes|caja)$/.test(hint);
  const accountFromHint = hint
    ? currencyAccounts.find((candidate) => {
        const candidateText = normalizeText(`${candidate.name} ${candidate.institution ?? ""}`);
        return (isCashHint && candidate.type === "CASH") || candidateText.includes(hint) || hint.includes(normalizeText(candidate.name));
      })
    : null;
  // An explicit source account is a safety instruction, never a suggestion.
  // If it does not match, leave the movement pending instead of using a default account.
  // A choice made in the assistant account picker is authoritative. Parser
  // hints are only used when the caller did not explicitly select an account.
  const account = selectedAccount
    ?? (hint
      ? accountFromHint
      : null);

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
  const categoryFromRuleId = matchCategoryFromRules(interpretation.merchant, merchantRules ?? []);
  const category = categoryFromRuleId
    ? (categories ?? []).find((candidate) => candidate.id === categoryFromRuleId)
    : interpretation.categoryHint
    ? (categories ?? []).find(
        (candidate) =>
          normalizeText(candidate.name) ===
          normalizeText(interpretation.categoryHint!)
      )
    : (categories ?? []).find(
        (candidate) =>
          interpretation.merchant != null &&
          normalizeText(candidate.name) === normalizeText(interpretation.merchant)
      );

  const requiresConfirmation =
    !interpretation.amount ||
    !account ||
    !(interpretation.merchant?.trim() || interpretation.description?.trim()) ||
    (interpretation.type === "TRANSFER" && !destinationAccount) ||
    (!parsedBody.data.confirmedByAssistant && interpretation.confidence < 0.85);

  if (
    parsedBody.data.source === "siri" &&
    interpretation.type !== "EXPENSE" &&
    interpretation.type !== "INCOME"
  ) {
    return NextResponse.json(
      {
        success: false,
        requiresConfirmation: false,
        error: "El Atajo de Siri solo puede registrar gastos o ingresos. Para esa accion, usa el asistente dentro de la app.",
      },
      { status: 400 }
    );
  }

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

  const service = createServiceClient();
  if (parsedBody.data.idempotencyKey) {
    const { data: existing } = await service
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("idempotency_key", parsedBody.data.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        requiresConfirmation: false,
        transaction: existing,
        message: "Ese movimiento ya estaba registrado.",
      });
    }
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
    p_source: databaseTransactionSource(interpretation.source),
    p_status: "CONFIRMED",
    p_idempotency_key: parsedBody.data.idempotencyKey ?? null,
    p_confidence: interpretation.confidence,
    p_raw_input: interpretation.rawInput,
  };
  const { data: transaction, error: createError } = await service.rpc(
    "create_financial_transaction_service",
    { p_user_id: userId, ...rpcArgs }
  );

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }
  try {
    await verifySavedTransactionAccount(service, userId, transaction, account!.id);
  } catch (reconciliationError) {
    return NextResponse.json({ error: reconciliationError instanceof Error ? reconciliationError.message : "El movimiento no se pudo verificar en la cuenta." }, { status: 500 });
  }

  const label =
    interpretation.type === "INCOME"
      ? "Ingreso"
      : interpretation.type === "TRANSFER"
        ? "Transferencia"
        : interpretation.type === "REFUND"
          ? "Devolución"
          : "Gasto";
  if (parsedBody.data.source === "siri" && (interpretation.type === "EXPENSE" || interpretation.type === "INCOME")) {
    const detail = category?.name ?? interpretation.merchant ?? label;
    await sendPushToUser(userId, {
      title: "La Pesadilla Finanzas",
      body: `${label} registrado correctamente. ${formatCurrency(interpretation.amount!, interpretation.currency)} · ${detail}`,
      url: "/movimientos",
    });
  }
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
