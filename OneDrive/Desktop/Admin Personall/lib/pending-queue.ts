export type PendingTransaction = {
  id: string;
  type?: string;
  amount: number;
  currency?: string;
  account_id: string;
  destination_account_id?: string | null;
  category_id: string | null;
  merchant?: string | null;
  note?: string | null;
  occurred_at: string;
};

const STORAGE_KEY = "pending_transactions";

export function getPending(): PendingTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingTransaction[];
  } catch {
    return [];
  }
}

export function addPending(tx: Omit<PendingTransaction, "id">): PendingTransaction {
  const item: PendingTransaction = {
    ...tx,
    id: crypto.randomUUID(),
  };
  const list = getPending();
  list.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return item;
}

export function removePending(id: string) {
  const list = getPending().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export async function flushPending(
  post: (body: Omit<PendingTransaction, "id">) => Promise<Response>
): Promise<number> {
  const list = getPending();
  let synced = 0;
  for (const item of list) {
    if (!item.account_id) {
      removePending(item.id);
      continue;
    }
    const res = await post({
      amount: item.amount,
      type: item.type,
      currency: item.currency,
      account_id: item.account_id,
      destination_account_id: item.destination_account_id,
      category_id: item.category_id,
      merchant: item.merchant,
      note: item.note,
      occurred_at: item.occurred_at,
    });
    if (res.ok) {
      removePending(item.id);
      synced += 1;
    }
  }
  return synced;
}
