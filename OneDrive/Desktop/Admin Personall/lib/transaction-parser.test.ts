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
    ["I spent 850 pesos on fuel using Itau", "EXPENSE", 850, "UYU"],
    ["I bought a perfume for 2890 pesos", "EXPENSE", 2890, "UYU"],
    ["I received 38600 pesos salary", "INCOME", 38600, "UYU"],
    ["I transferred 200 dollars from Itau to Scotia", "TRANSFER", 200, "USD"],
    ["I lent 500 pesos to Juan", "LOAN_GIVEN", 500, "UYU"],
    ["Juan paid me back 300 pesos", "REFUND", 300, "UYU"],
    ["Spent 500 pesos", "EXPENSE", 500, "UYU"],
    ["Income 1200 pesos", "INCOME", 1200, "UYU"],
    ["Transfer 200 dollars from Itau to Scotia", "TRANSFER", 200, "USD"],
  ] as const;

  for (const [text, type, amount, currency] of cases) {
    it(text, async () => {
      const result = await transactionParser.parse({ text });
      expect(result.type).toBe(type);
      expect(result.amount).toBe(amount);
      expect(result.currency).toBe(currency);
    });
  }

  it("detects the source account and merchant in a natural expense", async () => {
    const result = await transactionParser.parse({ text: "Gast\u00e9 620 del efectivo en Makelele" });
    expect(result.accountHint).toBe("efectivo");
    expect(result.merchant).toBe("Makelele");
  });

  it("treats cash as an explicit source account even when it follows the amount", async () => {
    const result = await transactionParser.parse({ text: "Gasté 500 en efectivo en nafta" });
    expect(result.accountHint).toBe("efectivo");
    expect(result.categoryHint).toBe("Combustible");
  });

  it("recognizes a source written as cuenta efectivo", async () => {
    const result = await transactionParser.parse({ text: "Gasté 500 de la cuenta efectivo en Makelele" });
    expect(result.accountHint).toBe("efectivo");
  });

  it("understands a casual spoken expense and account", async () => {
    const result = await transactionParser.parse({ text: "se me fueron 620 pesos desde el efectivo en Makelele" });
    expect(result.type).toBe("EXPENSE");
    expect(result.amount).toBe(620);
    expect(result.accountHint).toBe("efectivo");
    expect(result.merchant).toBe("Makelele");
  });

  it("understands a conversational income", async () => {
    const result = await transactionParser.parse({ text: "me entraron 38600 pesos del sueldo" });
    expect(result.type).toBe("INCOME");
    expect(result.amount).toBe(38600);
  });
});
