export type SimpleAssistantPlan = {
  action: "register_movement" | "create_account";
  message: string;
  data: { raw_text: string | null; account_id: null; category_id: null; name: string | null; institution: null; account_type: "CHECKING" | null; currency: string; amount: null; target_amount: null; date: null };
};

const MOVEMENT_WORDS = /\b(gaste|pague|compre|cobre|recibi|ingreso|sueldo|transferi|pase|preste|devolvio|ahorre|spent|paid|bought|received|earned|salary|transferred|lent|saved)\b/i;
const AMOUNT = /(?:\$|us\$|uyu|usd|pesos?|dolares?|dollars?)?\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\b(?:cien|doscientos|trescientos|cuatrocientos|quinientos|mil)\b/i;

function normalize(text: string) { return text.normalize("NFD").replace(/\p{Diacritic}/gu, ""); }
function currencyFor(text: string) { return /\b(usd|us\$|dolares?|dollars?)\b/i.test(normalize(text)) ? "USD" : "UYU"; }

function accountPlan(compact: string, normalized: string): SimpleAssistantPlan | null {
  if (!/\b(cuenta|account)\b/i.test(normalized) || !/\b(crea|crear|agrega|agregar|nueva|nuevo|add|create|new)\b/i.test(normalized)) return null;
  const name = compact.match(/\b(?:llamada|llamado|named)\s+(.+)$/i)?.[1]?.trim();
  if (!name || name.length > 60) return null;
  return { action: "create_account", message: `Voy a crear la cuenta ${name} en UYU. Confirmala para guardarla.`, data: { raw_text: null, account_id: null, category_id: null, name, institution: null, account_type: "CHECKING", currency: "UYU", amount: null, target_amount: null, date: null } };
}

/** Uses existing endpoints after confirmation; it only avoids AI for explicit, short requests. */
export function simpleAssistantPlan(text: string): SimpleAssistantPlan | null {
  const compact = text.trim();
  const normalized = normalize(compact);
  if (!compact || compact.length > 180) return null;
  const account = accountPlan(compact, normalized);
  if (account) return account;
  if (!MOVEMENT_WORDS.test(normalized) || !AMOUNT.test(normalized)) return null;
  return { action: "register_movement", message: "Entendi el movimiento. Revisalo y confirmalo para guardarlo.", data: { raw_text: compact, account_id: null, category_id: null, name: null, institution: null, account_type: null, currency: currencyFor(compact), amount: null, target_amount: null, date: null } };
}
