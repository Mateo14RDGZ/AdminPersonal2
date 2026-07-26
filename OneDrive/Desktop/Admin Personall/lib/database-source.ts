import type { TransactionSource } from "@/lib/database.types";

/** Keeps newer app sources compatible with databases created from the original enum. */
export function databaseTransactionSource(source: TransactionSource):
  | "manual"
  | "shortcut"
  | "email" {
  if (source === "shortcut" || source === "email" || source === "manual") return source;
  if (source === "siri") return "shortcut";
  return "manual";
}
