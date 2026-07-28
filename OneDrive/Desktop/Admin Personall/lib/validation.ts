import { z } from "zod";

export const transactionTypeSchema = z.enum([
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "CREDIT_CARD_PAYMENT",
  "ADJUSTMENT",
  "LOAN_GIVEN",
  "LOAN_RECEIVED",
  "REFUND",
]);

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

export const transactionSourceSchema = z.enum([
  "manual",
  "shortcut",
  "email",
  "text",
  "voice",
  "siri",
  "import",
  "receipt",
  "recurring",
  "system",
]);

export const ingestBodySchema = z.object({
  amount: z.coerce.number().positive(),
  merchant: z.string().max(500).optional().nullable(),
  card_name: z.string().max(200).optional().nullable(),
  occurred_at: z.string().datetime().optional().nullable(),
});

const transactionShape = z.object({
  type: transactionTypeSchema.default("EXPENSE"),
  amount: z.coerce.number().positive(),
  currency: currencySchema.default("UYU"),
  account_id: z.string().uuid(),
  destination_account_id: z.string().uuid().optional().nullable(),
  credit_card_id: z.string().uuid().optional().nullable(),
  merchant: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  occurred_at: z.string().datetime().optional(),
  source: transactionSourceSchema.default("manual"),
  status: z.enum(["CONFIRMED", "PENDING_REVIEW", "ESTIMATED"]).default("CONFIRMED"),
  idempotency_key: z.string().min(8).max(200).optional().nullable(),
});

function requireMovementDescription(
  value: { merchant?: string | null; description?: string | null; note?: string | null; notes?: string | null },
  context: z.RefinementCtx
) {
  const hasDescription = [value.merchant, value.description, value.note, value.notes]
    .some((item) => typeof item === "string" && item.trim().length > 0);
  if (!hasDescription) {
    context.addIssue({
      code: "custom",
      path: ["merchant"],
      message: "Cada movimiento necesita una descripción o comercio.",
    });
  }
}

export const createTransactionSchema = transactionShape.superRefine(requireMovementDescription);

export const patchTransactionSchema = z.object({
  type: transactionTypeSchema.optional(),
  amount: z.coerce.number().positive().optional(),
  currency: currencySchema.optional(),
  account_id: z.string().uuid().optional().nullable(),
  destination_account_id: z.string().uuid().optional().nullable(),
  credit_card_id: z.string().uuid().optional().nullable(),
  merchant: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  occurred_at: z.string().datetime().optional(),
  status: z.enum(["CONFIRMED", "PENDING_REVIEW", "ESTIMATED"]).optional(),
});

export const quickTransactionSchema = transactionShape.extend({
  account_id: z.string().uuid(),
}).superRefine(requireMovementDescription);

export const parseTransactionSchema = z.object({
  text: z.string().trim().min(2).max(1000),
  source: transactionSourceSchema.default("text"),
  timezone: z.string().default("America/Montevideo"),
  dryRun: z.boolean().default(false),
  defaultAccountId: z.string().uuid().optional().nullable(),
  defaultCurrency: currencySchema.default("UYU"),
  confirmedByAssistant: z.boolean().default(false),
  occurredAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().min(8).max(200).optional().nullable(),
});

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  institution: z.string().trim().max(100).optional().nullable(),
  type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]),
  currency: currencySchema,
  initial_balance: z.coerce.number().finite().default(0),
  icon: z.string().max(50).default("wallet"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1D9E75"),
  is_savings_account: z.boolean().default(false),
  is_default: z.boolean().default(false),
});

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  institution: z.string().trim().max(100).optional().nullable(),
  type: z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL_WALLET", "OTHER"]),
  current_balance: z.coerce.number().finite(),
  is_default: z.boolean().default(false),
});

export const savingsGoalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  target_amount: z.coerce.number().positive(),
  current_amount: z.coerce.number().nonnegative().default(0),
  currency: currencySchema,
  target_date: z.string().date().optional().nullable(),
  linked_account_id: z.string().uuid().optional().nullable(),
  is_primary: z.boolean().default(false),
});

export const creditCardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  institution: z.string().trim().max(100).optional().nullable(),
  linked_account_id: z.string().uuid().optional().nullable(),
  currency: currencySchema,
  credit_limit: z.coerce.number().nonnegative(),
  current_used_amount: z.coerce.number().nonnegative().default(0),
  closing_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
});

export const recurringTransactionSchema = z.object({
  type: transactionTypeSchema.default("EXPENSE"),
  amount: z.coerce.number().positive(),
  currency: currencySchema,
  account_id: z.string().uuid(),
  credit_card_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  merchant: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  interval_count: z.coerce.number().int().positive().default(1),
  next_execution_date: z.string().date(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional().nullable(),
  auto_create: z.boolean().default(false),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  monthly_budget: z.coerce.number().nonnegative().nullable().optional(),
});

export const merchantRuleSchema = z.object({
  pattern: z.string().min(1).max(200),
  category_id: z.string().uuid(),
});
