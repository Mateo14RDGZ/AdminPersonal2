import { z } from "zod";

export const ingestBodySchema = z.object({
  amount: z.coerce.number().positive(),
  merchant: z.string().max(500).optional().nullable(),
  card_name: z.string().max(200).optional().nullable(),
  occurred_at: z.string().datetime().optional().nullable(),
});

export const createTransactionSchema = z.object({
  amount: z.coerce.number().positive(),
  merchant: z.string().max(500).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  occurred_at: z.string().datetime().optional(),
});

export const patchTransactionSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  merchant: z.string().max(500).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  occurred_at: z.string().datetime().optional(),
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
