import { describe, expect, it } from "vitest";
import { transactionParser } from "./transaction-parser";

describe("LocalTransactionParser", () => {
  const cases = [
    ["Gasté 450 pesos en panadería", "EXPENSE", 450, "UYU"],
    ["Gasté $450 en comida", "EXPENSE", 450, "UYU"],
    ["Gasté 20 dólares en perfume", "EXPENSE", 20, "USD"],
    ["Cobré 38600 de sueldo", "INCOME", 38600, "UYU"],
    ["Transferí USD 200 de Itaú a Scotia", "TRANSFER", 200, "USD"],
    ["Ayer pagué 1200 de nafta", "EXPENSE", 1200, "UYU"],
    ["Anotá 500", "EXPENSE", 500, "UYU"],
    ["Gasté quinientos pesos", "EXPENSE", 500, "UYU"],
    ["Me devolvieron 300", "REFUND", 300, "UYU"],
    ["Presté 500 a Juan", "LOAN_GIVEN", 500, "UYU"],
  ] as const;

  for (const [text, type, amount, currency] of cases) {
    it(text, async () => {
      const result = await transactionParser.parse({ text });
      expect(result.type).toBe(type);
      expect(result.amount).toBe(amount);
      expect(result.currency).toBe(currency);
    });
  }
});

