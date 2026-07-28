export type SimpleAssistantPlan = {
  action: "reply" | "register_movement" | "create_account" | "create_category";
  message: string;
  data: { raw_text: string | null; account_id: null; category_id: null; name: string | null; institution: null; account_type: "CHECKING" | null; currency: string; amount: null; target_amount: null; date: null; color: string | null };
};

type HistoryMessage = { role: string; content: string };

const MOVEMENT_WORDS = /\b(gaste|pague|compre|cobre|recibi|ingreso|sueldo|transferi|pase|preste|devolvio|ahorre|spent|paid|bought|received|earned|salary|transferred|lent|saved)\b/i;
const AMOUNT = /(?:\$|us\$|uyu|usd|pesos?|dolares?|dollars?)?\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\b(?:cien|doscientos|trescientos|cuatrocientos|quinientos|mil)\b/i;

function normalize(text: string) { return text.normalize("NFD").replace(/\p{Diacritic}/gu, ""); }
function currencyFor(text: string) { return /\b(usd|us\$|dolares?|dollars?)\b/i.test(normalize(text)) ? "USD" : "UYU"; }
function colorFor(text: string): string | null {
  const normalized = normalize(text).toLowerCase();
  const hex = normalized.match(/#[0-9a-f]{6}\b/i)?.[0];
  if (hex) return hex.toUpperCase();
  const colors: Array<[RegExp, string]> = [[/\brojo\b|\bred\b/, "#E05263"], [/\bazul\b|\bblue\b/, "#4F6DF5"], [/\bverde\b|\bgreen\b/, "#22A06B"], [/\bvioleta\b|\bmorado\b|\bpurple\b/, "#8B5CF6"], [/\bnaranja\b|\borange\b/, "#EA6A3E"], [/\bamarillo\b|\byellow\b/, "#D99100"], [/\brosado\b|\brosa\b|\bpink\b/, "#E85D9A"], [/\bgris\b|\bgray\b|\bgrey\b/, "#64748B"]];
  return colors.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}
const emptyData = { raw_text: null, account_id: null, category_id: null, name: null, institution: null, account_type: null, currency: "UYU", amount: null, target_amount: null, date: null, color: null };

function categoryPlan(compact: string, normalized: string): SimpleAssistantPlan | null {
  if (!/\b(categoria|category)\b/i.test(normalized) || !/\b(crea|crear|agrega|agregar|nueva|nuevo|add|create|new)\b/i.test(normalized)) return null;
  const name = compact.match(/\b(?:llamada|llamado|named)\s+(.+)$/i)?.[1]?.trim();
  if (!name || name.length > 60) return null;
  const color = colorFor(compact) ?? "#64748B";
  if (!color) return { action: "reply", message: `¿Qué color querés para la categoría ${name}? Podés decir, por ejemplo, azul, naranja, violeta o un código como #4F6DF5.`, data: { ...emptyData, name } };
  return { action: "create_category", message: `Voy a crear la categoría ${name} con ese color. Confirmala para guardarla.`, data: { ...emptyData, name, color } };
}

function categoryColorReply(compact: string, history: HistoryMessage[]): SimpleAssistantPlan | null {
  const color = colorFor(compact);
  if (!color) return null;
  const previousCategoryRequest = [...history].reverse().find((message) => message.role === "assistant" && /que color queres para la categoria/i.test(normalize(message.content)));
  const name = previousCategoryRequest ? normalize(previousCategoryRequest.content).match(/categoria\s+(.+?)\?/i)?.[1]?.trim() : null;
  return name ? { action: "create_category", message: `Voy a crear la categoría ${name} con ese color. Confirmala para guardarla.`, data: { ...emptyData, name, color } } : null;
}

/** Uses existing endpoints after confirmation; it only avoids AI for explicit, short requests. */
export function simpleAssistantPlan(text: string, history: HistoryMessage[] = []): SimpleAssistantPlan | null {
  const compact = text.trim();
  const normalized = normalize(compact);
  if (!compact || compact.length > 180) return null;
  const category = categoryPlan(compact, normalized);
  if (category) return category;
  const categoryColor = categoryColorReply(compact, history);
  if (categoryColor) return categoryColor;
  if (!MOVEMENT_WORDS.test(normalized) || !AMOUNT.test(normalized)) return null;
  // A named source account must be resolved against the real account list by
  // the guided assistant. Never let the fast path silently use a default.
  if (/\b(?:efectivo|cash|desde|del|de la cuenta|con)\b/i.test(normalized)) return null;
  return { action: "register_movement", message: "Entendi el movimiento. Revisalo y confirmalo para guardarlo.", data: { ...emptyData, raw_text: compact, currency: currencyFor(compact) } };
}
