import { describe, expect, it } from "vitest";
import { simpleAssistantPlan } from "./simple-assistant";

describe("simpleAssistantPlan", () => {
  it("resolves a short expense without AI", () => {
    expect(simpleAssistantPlan("Gast\u00e9 500 pesos en nafta")?.data).toMatchObject({ raw_text: "Gast\u00e9 500 pesos en nafta", currency: "UYU" });
  });
  it("keeps dollars as USD", () => {
    expect(simpleAssistantPlan("Ahorr\u00e9 200 d\u00f3lares")?.data.currency).toBe("USD");
  });
  it("sends account setup to the guided assistant", () => {
    expect(simpleAssistantPlan("crea una cuenta llamada itau")).toBeNull();
  });
  it("proposes a category immediately with a safe default color", () => {
    expect(simpleAssistantPlan("crea una categoria llamada viajes")).toMatchObject({
      action: "create_category",
      data: { name: "viajes", color: "#64748B" },
    });
  });
  it("sends complex requests to AI", () => {
    expect(simpleAssistantPlan("Crea una cuenta para los gastos que hago en viajes y organiza todo")).toBeNull();
  });
});
