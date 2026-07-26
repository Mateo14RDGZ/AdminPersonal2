-- Enums and tables
CREATE TYPE public.transaction_source AS ENUM ('manual', 'shortcut', 'email');

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'category',
  color TEXT NOT NULL DEFAULT '#6B7280',
  monthly_budget NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  merchant TEXT,
  note TEXT,
  category_id UUID REFERENCES public.categories (id) ON DELETE SET NULL,
  card_name TEXT,
  source public.transaction_source NOT NULL DEFAULT 'manual',
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.merchant_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX categories_user_id_idx ON public.categories (user_id);
CREATE INDEX transactions_user_id_idx ON public.transactions (user_id);
CREATE INDEX transactions_occurred_at_idx ON public.transactions (occurred_at DESC);
CREATE INDEX transactions_user_occurred_idx ON public.transactions (user_id, occurred_at DESC);
CREATE INDEX merchant_rules_user_id_idx ON public.merchant_rules (user_id);
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_own" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "merchant_rules_select_own" ON public.merchant_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "merchant_rules_insert_own" ON public.merchant_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "merchant_rules_update_own" ON public.merchant_rules
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "merchant_rules_delete_own" ON public.merchant_rules
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Default categories for new users
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, icon, color, monthly_budget) VALUES
    (NEW.id, 'Comida', 'tools-kitchen-2', '#F97316', NULL),
    (NEW.id, 'Transporte', 'bus', '#3B82F6', NULL),
    (NEW.id, 'Compras', 'shopping-bag', '#A855F7', NULL),
    (NEW.id, 'Servicios', 'receipt', '#6B7280', NULL),
    (NEW.id, 'Salud', 'heart', '#EF4444', NULL),
    (NEW.id, 'Ocio', 'movie', '#EC4899', NULL),
    (NEW.id, 'Hogar', 'home', '#1D9E75', NULL),
    (NEW.id, 'Otros', 'dots', '#78716C', NULL);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_seed_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_categories();
