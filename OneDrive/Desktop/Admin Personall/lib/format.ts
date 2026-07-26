const LOCALE = "es-UY";

export const SUPPORTED_CURRENCIES = [
  { code: "UYU", label: "Peso uruguayo", symbol: "$" },
  { code: "USD", label: "Dólar estadounidense", symbol: "US$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "BRL", label: "Real brasileño", symbol: "R$" },
  { code: "ARS", label: "Peso argentino", symbol: "AR$" },
] as const;

export function formatCurrency(
  amount: number,
  currency = "UYU"
): string {
  const normalizedCurrency = /^[A-Z]{3}$/.test(currency) ? currency : "UYU";
  const usesDecimals = !["UYU", "ARS"].includes(normalizedCurrency);

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: normalizedCurrency,
    currencyDisplay: normalizedCurrency === "UYU" ? "symbol" : "code",
    minimumFractionDigits: usesDecimals ? 2 : 0,
    maximumFractionDigits: usesDecimals ? 2 : 0,
  }).format(amount);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayHeader(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function sourceLabel(source: string): string {
  switch (source) {
    case "shortcut":
      return "Automático";
    case "email":
      return "Email";
    default:
      return "Manual";
  }
}

export function monthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = new Date(year, monthNumber - 1, 1);
  const to = new Date(year, monthNumber, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
