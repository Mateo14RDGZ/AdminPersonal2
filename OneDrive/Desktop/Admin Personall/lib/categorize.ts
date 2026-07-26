import type { MerchantRule } from "./database.types";

export function matchCategoryFromRules(
  merchant: string | null | undefined,
  rules: MerchantRule[]
): string | null {
  if (!merchant?.trim()) return null;
  const normalized = merchant.toLowerCase();
  for (const rule of rules) {
    const pattern = rule.pattern.trim();
    if (!pattern) continue;
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      try {
        const re = new RegExp(pattern.slice(1, -1), "i");
        if (re.test(merchant)) return rule.category_id;
      } catch {
        // invalid regex — fall through to substring
      }
    } else if (normalized.includes(pattern.toLowerCase())) {
      return rule.category_id;
    }
  }
  return null;
}
