export type SimpleAssistantPlan = {
  action: "register_movement";
  message: string;
  data: {
    raw_text: string;
    account_id: null;
    category_id: null;
    name: null;
    institution: null;
    account_type: null;
    currency: string;
    amount: null;
    target_amount: null;
    date: null;
  };
};

const MOVEMENT_WORDS = /\b(gaste|pague|compre|cobre|recibi|ingreso|sueldo|transferi|pase|preste|devolvio|ahorre|spent|paid|bought|received|earned|salary|transferred|lent|saved)\b/i;
const AMOUNT = /(?:\$|us\$|uyu|usd|pesos?|dolares?|dollars?)?\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\b(?:cien|doscientos|trescientos|cuatrocientos|quinientos|mil)\b/i;

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function currencyFor(text: string) {
  return /\b(usd|us\$|dolares?|dollars?)\b/i.test(normalize(text)) ? "USD" : "UYU";
}

/** Uses the existing parser after confirmation; it only avoids an AI call for explicit short movements. */
export function simpleMovementPlan(text: string): SimpleAssistantPlan | null {
  const compact = text.trim();
  const normalized = normalize(compact);
  if (!compact || compact.length > 180 || !MOVEMENT_WORDS.test(normalized) || !AMOUNT.test(normalized)) return null;
  return {
    action: "register_movement",
    message: "Entendi el movimiento. Revisalo y confirmalo para guardarlo.",
    data: { raw_text: compact, account_id: null, category_id: null, name: null, institution: null, account_type: null, currency: currencyFor(compact), amount: null, target_amount: null, date: null },
  };
}
