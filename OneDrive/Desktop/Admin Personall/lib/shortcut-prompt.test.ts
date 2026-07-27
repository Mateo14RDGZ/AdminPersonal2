import { describe, expect, it } from "vitest";
import { AUTOMATION_TEST_ENDPOINT, buildIosShortcutPrompt, PARSE_TRANSACTION_ENDPOINT, shortcutRequestJson } from "./shortcut-prompt";

describe("prompt de Atajos", () => {
  it("mantiene el contrato real de la API de automatizaciones", () => {
    const prompt = buildIosShortcutPrompt("lpf_token_de_prueba");
    expect(prompt).toContain(PARSE_TRANSACTION_ENDPOINT);
    expect(prompt).toContain(AUTOMATION_TEST_ENDPOINT);
    expect(prompt).toContain("Authorization: Bearer lpf_token_de_prueba");
    expect(prompt).toContain('"source": "siri"');
    expect(prompt).toContain('"timezone": "America/Montevideo"');
    expect(prompt).toContain('"dryRun": false');
    expect(prompt).toContain('"idempotencyKey": IdempotencyKey');
    expect(prompt).toContain("No envies un campo shortcutName");
    expect(prompt).toContain("confirmationUrl");
    expect(prompt).toContain("unicamente gastos o ingresos");
  });

  it("expone un JSON que coincide con el cuerpo de parse-transaction", () => {
    expect(JSON.parse(shortcutRequestJson())).toEqual({ text: "Texto dictado", source: "siri", timezone: "America/Montevideo", dryRun: false, defaultCurrency: "UYU", idempotencyKey: "UUID nuevo en cada ejecucion" });
  });
});
