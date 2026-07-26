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
          amount: number;
          merchant: string | null;
          note: string | null;
          category_id: string | null;
          card_name: string | null;
          source: "manual" | "shortcut" | "email";
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          merchant?: string | null;
          note?: string | null;
          category_id?: string | null;
          card_name?: string | null;
          source?: "manual" | "shortcut" | "email";
          occurred_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          merchant?: string | null;
          note?: string | null;
          category_id?: string | null;
          card_name?: string | null;
          source?: "manual" | "shortcut" | "email";
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
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
          is_recurring?: boolean;
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      transaction_source: "manual" | "shortcut" | "email";
    };
  };
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
