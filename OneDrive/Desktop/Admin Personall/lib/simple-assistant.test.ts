import { describe, expect, it } from "vitest";
import { simpleMovementPlan } from "./simple-assistant";

describe("simpleMovementPlan", () => {
  it("resolves a short expense without AI", () => {
    expect(simpleMovementPlan("Gast\u00e9 500 pesos en nafta")?.data).toMatchObject({ raw_text: "Gast\u00e9 500 pesos en nafta", currency: "UYU" });
  });
  it("keeps dollars as USD", () => {
    expect(simpleMovementPlan("Ahorr\u00e9 200 d\u00f3lares")?.data.currency).toBe("USD");
  });
  it("sends complex requests to AI", () => {
    expect(simpleMovementPlan("Crea una cuenta para los gastos que hago en viajes y organiza todo")).toBeNull();
  });
});
