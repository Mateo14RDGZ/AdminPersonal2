-- Aligns databases created with the original SQL Editor script with the app.
-- Safe to run more than once and does not delete existing data.

CREATE INDEX IF NOT EXISTS categories_user_id_idx
  ON public.categories (user_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx
  ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS transactions_occurred_at_idx
  ON public.transactions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS transactions_user_occurred_idx
  ON public.transactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS merchant_rules_user_id_idx
  ON public.merchant_rules (user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx
  ON public.push_subscriptions (user_id, endpoint);

DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "merchant_rules_update_own" ON public.merchant_rules;
CREATE POLICY "merchant_rules_update_own" ON public.merchant_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
