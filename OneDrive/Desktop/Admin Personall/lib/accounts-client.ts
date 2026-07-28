import type { Account } from "@/lib/database.types";

let cachedAccounts: Account[] | null = null;
let inflight: Promise<Account[]> | null = null;

export function readCachedAccounts() {
  return cachedAccounts;
}

export async function loadAccounts(options: { refresh?: boolean } = {}) {
  if (!options.refresh && cachedAccounts) return cachedAccounts;
  if (!options.refresh && inflight) return inflight;

  const request = fetch("/api/accounts", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("No se pudieron cargar las cuentas.");
      const accounts = (await response.json()) as Account[];
      cachedAccounts = accounts;
      return accounts;
    })
    .finally(() => {
      inflight = null;
    });

  inflight = request;
  return request;
}

export function setCachedAccounts(accounts: Account[]) {
  cachedAccounts = accounts;
}

/** Starts the request while the user is still on Inicio, avoiding a blank wait in Ajustes. */
export function preloadAccounts() {
  void loadAccounts().catch(() => undefined);
}
