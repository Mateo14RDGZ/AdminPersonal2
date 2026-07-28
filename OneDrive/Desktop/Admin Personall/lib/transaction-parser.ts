import type {
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from "@/lib/database.types";

export type ParseTransactionInput = {
  text: string;
  source?: TransactionSource;
  timezone?: string;
  defaultAccountId?: string | null;
  defaultCurrency?: string;
  occurredAt?: string | null;
  idempotencyKey?: string | null;
};

export type ParsedTransaction = {
  type: TransactionType;
  amount: number | null;
  currency: string;
  accountHint: string | null;
  destinationAccountHint: string | null;
  merchant: string | null;
  categoryHint: string | null;
  description: string | null;
  occurredAt: string;
  source: TransactionSource;
  status: TransactionStatus;
  confidence: number;
  rawInput: string;
};

const SMALL_NUMBERS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$€.,\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWrittenNumber(text: string): number | null {
  const words = normalizeText(text).split(" ");
  let total = 0;
  let current = 0;
  let matched = false;

  for (const word of words) {
    if (word === "y") continue;
    if (word === "mil") {
      current = Math.max(1, current) * 1000;
      total += current;
      current = 0;
      matched = true;
      continue;
    }
    if (HUNDREDS[word] != null) {
      current += HUNDREDS[word];
      matched = true;
      continue;
    }
    if (SMALL_NUMBERS[word] != null) {
      current += SMALL_NUMBERS[word];
      matched = true;
      continue;
    }
    if (matched) break;
  }
  return matched ? total + current : null;
}

function parseAmount(text: string): number | null {
  const numeric = text.match(
    /(?:usd|uyu|us\$|ars|ar\$|\$|€)?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/
  );
  if (numeric) {
    const raw = numeric[1].replace(/\s/g, "");
    const normalized =
      raw.includes(",") && raw.includes(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.includes(",")
          ? raw.replace(",", ".")
          : /^\d{1,3}(?:\.\d{3})+$/.test(raw)
            ? raw.replace(/\./g, "")
            : raw;
    const value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return parseWrittenNumber(text);
}

function detectType(text: string): TransactionType {
  if (/\b(transferred|transfer|moved|move)\b/.test(text) || /\bfrom\s+.+\s+to\s+/.test(text))
    return "TRANSFER";
  if (/\b(i lent|lent)\b/.test(text)) return "LOAN_GIVEN";
  if (/\b(paid me back|refunded|refund)\b/.test(text)) return "REFUND";
  if (/\b(i received|received|salary|income|earned|got paid)\b/.test(text)) return "INCOME";
  if (/\b(transferi|pase|transferencia)\b/.test(text)) return "TRANSFER";
  if (/\b(preste|prestamo dado)\b/.test(text)) return "LOAN_GIVEN";
  if (/\b(me devolvio|me devolvieron|reembolso|devolucion)\b/.test(text))
    return "REFUND";
  if (/\b(cobre|cobré|depositaron|recibi|ingreso|sueldo)\b/.test(text))
    return "INCOME";
  if (/\b(me entraron|me pagaron|me ingresaron)\b/.test(text)) return "INCOME";
  return "EXPENSE";
}

function detectCurrency(text: string, fallback: string): string {
  if (/\b(dollar|dollars)\b/.test(text)) return "USD";
  if (/\b(argentine peso|argentine pesos)\b/.test(text)) return "ARS";
  if (/\b(uruguayan peso|uruguayan pesos)\b/.test(text)) return "UYU";
  if (/\b(dolar|dolares|usd)\b|us\$/.test(text)) return "USD";
  if (/\b(euro|euros|eur)\b|€/.test(text)) return "EUR";
  if (/\b(real|reales|brl)\b/.test(text)) return "BRL";
  if (/\b(peso argentino|pesos argentinos|ars|ar\$)\b/.test(text))
    return "ARS";
  if (/\b(peso|pesos|uyu)\b|\$/.test(text)) return "UYU";
  return fallback;
}

function detectDate(text: string, explicit?: string | null): string {
  if (explicit) return new Date(explicit).toISOString();
  const date = new Date();
  if (/\b(ayer|yesterday)\b/.test(text)) date.setDate(date.getDate() - 1);
  return date.toISOString();
}

function detectCategory(text: string): string | null {
  const rules: Array<[RegExp, string]> = [
    [/\b(nafta|combustible|ancap)\b/, "Combustible"],
    [/\b(supermercado|supermarket|tata|ta-ta|devoto|disco)\b/, "Supermercado"],
    [/\b(panaderia|bakery|comida|food|restaurant|restaurante|mcdonald)\b/, "Comida"],
    [/\b(uber|taxi|boleto|bus|omnibus|transporte|transport)\b/, "Transporte"],
    [/\b(antel|telefono|phone|internet)\b/, "Servicios"],
    [/\b(netflix|spotify|streaming|apple)\b/, "Ocio"],
    [/\b(farmacia|pharmacy|medico|doctor|salud|health)\b/, "Salud"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function extractAccountHints(text: string, type: TransactionType) {
  if (type === "TRANSFER") {
    const match = text.match(/\bde\s+(.+?)\s+a\s+(.+?)(?:$|\s+(?:ayer|hoy))/)
      ?? text.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:$|\s+(?:yesterday|today))/);
    return {
      accountHint: match?.[1]?.trim() ?? null,
      destinationAccountHint: match?.[2]?.trim() ?? null,
    };
  }
  if (/\b(?:en|con)\s+(?:la\s+)?(?:cuenta\s+)?efectivo\b|\bcash\b/.test(text)) {
    return { accountHint: "efectivo", destinationAccountHint: null };
  }
  const match = text.match(/\b(?:del|de la|desde)\s+([\p{L}\p{N} -]+?)\s+(?:en|para)\s+/u)
    ?? text.match(/\b(?:desde|con)\s+(?:mi |la |el )?([\p{L}\p{N} -]+?)(?:\s+(?:en|para)\s+|$)/u)
    ?? text.match(/\bcon\s+([\p{L}\p{N} -]+)$/u)
    ?? text.match(/\b(?:with|using)\s+([\p{L}\p{N} -]+)$/u);
  return {
    accountHint: match?.[1]?.trim().replace(/^(?:el|la|mi)\s+(?:cuenta\s+)?/i, "").replace(/^cuenta\s+/i, "") ?? null,
    destinationAccountHint: null,
  };
}

function extractMerchant(text: string, type: TransactionType): string | null {
  if (type === "TRANSFER") return null;
  const inMatch = text.match(
    /\ben\s+(?:la |el )?(.+?)(?:\s+con\s+[\p{L}\p{N} -]+)?$/u
  );
  if (inMatch?.[1]) return titleCase(inMatch[1]);
  const casualMatch = text.match(/\b(?:se me fueron|me cobraron|pague)\s+.+?\s+(?:en|de)\s+(?:la |el )?(.+)$/u);
  if (casualMatch?.[1]) return titleCase(casualMatch[1]);
  const itemMatch = text.match(
    /\b(?:compre|pague|gaste|i bought|i paid|i spent)\s+(?:un |una |el |la |a |an )?([\p{L} -]+?)\s+(?:por|de|for)\s+/u
  );
  return itemMatch?.[1] ? titleCase(itemMatch[1]) : null;
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export class LocalTransactionParser {
  async parse(input: ParseTransactionInput): Promise<ParsedTransaction> {
    const text = normalizeText(input.text);
    const type = detectType(text);
    const amount = parseAmount(text);
    const currency = detectCurrency(
      text,
      input.defaultCurrency?.toUpperCase() || "UYU"
    );
    const hints = extractAccountHints(text, type);
    const merchant = extractMerchant(text, type);
    const categoryHint = detectCategory(text);
    let confidence = amount ? 0.72 : 0.35;
    if (merchant || categoryHint) confidence += 0.1;
    if (hints.accountHint || input.defaultAccountId) confidence += 0.08;
    if (type !== "EXPENSE" || /\b(gaste|pague|compre|anota|spent|paid|bought)\b/.test(text))
      confidence += 0.06;

    return {
      type,
      amount,
      currency,
      ...hints,
      merchant,
      categoryHint,
      description: null,
      occurredAt: detectDate(text, input.occurredAt),
      source: input.source ?? "text",
      status: confidence >= 0.85 ? "CONFIRMED" : "PENDING_REVIEW",
      confidence: Math.min(0.99, confidence),
      rawInput: input.text.trim(),
    };
  }
}

export interface TransactionParser {
  parse(input: ParseTransactionInput): Promise<ParsedTransaction>;
}

export const transactionParser: TransactionParser = new LocalTransactionParser();
