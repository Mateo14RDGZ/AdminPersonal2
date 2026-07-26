export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          color: string;
          monthly_budget: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          icon?: string;
          color?: string;
          monthly_budget?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          icon?: string;
          color?: string;
          monthly_budget?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          currency: string;
          account_id: string | null;
          destination_account_id: string | null;
          credit_card_id: string | null;
          merchant: string | null;
          description: string | null;
          notes: string | null;
          note: string | null;
          category_id: string | null;
          card_name: string | null;
          source: TransactionSource;
          status: TransactionStatus;
          external_id: string | null;
          fingerprint: string | null;
          idempotency_key: string | null;
          confidence: number | null;
          raw_input: string | null;
          receipt_url: string | null;
          occurred_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: TransactionType;
          amount: number;
          currency?: string;
          account_id?: string | null;
          destination_account_id?: string | null;
          credit_card_id?: string | null;
          merchant?: string | null;
          description?: string | null;
          notes?: string | null;
          note?: string | null;
          category_id?: string | null;
          card_name?: string | null;
          source?: TransactionSource;
          status?: TransactionStatus;
          external_id?: string | null;
          fingerprint?: string | null;
          idempotency_key?: string | null;
          confidence?: number | null;
          raw_input?: string | null;
          receipt_url?: string | null;
          occurred_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: TransactionType;
          amount?: number;
          currency?: string;
          account_id?: string | null;
          destination_account_id?: string | null;
          credit_card_id?: string | null;
          merchant?: string | null;
          description?: string | null;
          notes?: string | null;
          note?: string | null;
          category_id?: string | null;
          card_name?: string | null;
          source?: TransactionSource;
          status?: TransactionStatus;
          external_id?: string | null;
          fingerprint?: string | null;
          idempotency_key?: string | null;
          confidence?: number | null;
          raw_input?: string | null;
          receipt_url?: string | null;
          occurred_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: TableDefinition<Account>;
      credit_cards: TableDefinition<CreditCard>;
      budgets: TableDefinition<Budget>;
      savings_goals: TableDefinition<SavingsGoal>;
      recurring_transactions: TableDefinition<RecurringTransaction>;
      automation_tokens: TableDefinition<AutomationToken>;
      pending_transaction_confirmations: TableDefinition<PendingConfirmation>;
      audit_logs: TableDefinition<AuditLog>;
      import_batches: TableDefinition<ImportBatch>;
      merchant_rules: {
        Row: {
          id: string;
          user_id: string;
          pattern: string;
          category_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pattern: string;
          category_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pattern?: string;
          category_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      financial_entries: {
        Row: {
          id: string;
          user_id: string;
          kind: "income" | "saving";
          name: string;
          amount: number;
          currency: string;
          is_recurring: boolean;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: "income" | "saving";
          name: string;
          amount: number;
          currency?: string;
          is_recurring?: boolean;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: "income" | "saving";
          name?: string;
          amount?: number;
          currency?: string;
          is_recurring?: boolean;
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_financial_transaction: {
        Args: {
          p_type: string;
          p_amount: number;
          p_currency: string;
          p_account_id: string;
          p_destination_account_id?: string | null;
          p_credit_card_id?: string | null;
          p_category_id?: string | null;
          p_merchant?: string | null;
          p_description?: string | null;
          p_notes?: string | null;
          p_occurred_at?: string;
          p_source?: string;
          p_status?: string;
          p_idempotency_key?: string | null;
          p_confidence?: number | null;
          p_raw_input?: string | null;
        };
        Returns: Transaction;
      };
      create_financial_transaction_service: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_amount: number;
          p_currency: string;
          p_account_id: string;
          p_destination_account_id?: string | null;
          p_category_id?: string | null;
          p_merchant?: string | null;
          p_description?: string | null;
          p_occurred_at?: string;
          p_source?: string;
          p_status?: string;
          p_idempotency_key?: string | null;
          p_confidence?: number | null;
          p_raw_input?: string | null;
        };
        Returns: Transaction;
      };
      delete_financial_transaction: {
        Args: { p_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      transaction_source: TransactionSource;
    };
  };
};

type TableDefinition<T extends { id: string }> = {
  Row: T;
  Insert: Partial<Omit<T, "id" | "created_at" | "updated_at" | "user_id">> & {
    id?: string;
    user_id: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<Omit<T, "id">> & { id?: string };
  Relationships: [];
};

export type TransactionType =
  | "EXPENSE"
  | "INCOME"
  | "TRANSFER"
  | "CREDIT_CARD_PAYMENT"
  | "ADJUSTMENT"
  | "LOAN_GIVEN"
  | "LOAN_RECEIVED"
  | "REFUND";
export type TransactionStatus = "CONFIRMED" | "PENDING_REVIEW" | "ESTIMATED";
export type TransactionSource =
  | "manual"
  | "shortcut"
  | "email"
  | "text"
  | "voice"
  | "siri"
  | "import"
  | "receipt"
  | "recurring"
  | "system";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  type: "CASH" | "CHECKING" | "SAVINGS" | "DIGITAL_WALLET" | "OTHER";
  currency: string;
  initial_balance: number;
  current_balance: number;
  icon: string;
  color: string;
  is_savings_account: boolean;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditCard = {
  id: string;
  user_id: string;
  linked_account_id: string | null;
  name: string;
  institution: string | null;
  currency: string;
  credit_limit: number;
  current_used_amount: number;
  closing_day: number | null;
  due_day: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string | null;
  account_id: string | null;
  amount: number;
  currency: string;
  period: "WEEKLY" | "MONTHLY" | "YEARLY";
  start_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SavingsGoal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date: string | null;
  linked_account_id: string | null;
  icon: string;
  is_primary: boolean;
  is_completed: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type RecurringTransaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  account_id: string | null;
  credit_card_id: string | null;
  category_id: string | null;
  merchant: string | null;
  description: string | null;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval_count: number;
  next_execution_date: string;
  start_date: string;
  end_date: string | null;
  auto_create: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AutomationToken = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PendingConfirmation = {
  id: string;
  user_id: string;
  raw_input: string;
  parsed_payload: Json;
  source: string;
  expires_at: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ImportBatch = {
  id: string;
  user_id: string;
  file_name: string;
  source_institution: string | null;
  status: string;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  error_rows: number;
  created_at: string;
  updated_at: string;
};

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type MerchantRule = Database["public"]["Tables"]["merchant_rules"]["Row"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type FinancialEntry =
  Database["public"]["Tables"]["financial_entries"]["Row"];

export type TransactionWithCategory = Transaction & {
  categories: Pick<Category, "id" | "name" | "icon" | "color"> | null;
};
