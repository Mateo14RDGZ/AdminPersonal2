import { describe, expect, it } from "vitest";
import { databaseTransactionSource } from "./database-source";

describe("databaseTransactionSource", () => {
  it("keeps legacy sources", () => {
    expect(databaseTransactionSource("manual")).toBe("manual");
    expect(databaseTransactionSource("shortcut")).toBe("shortcut");
    expect(databaseTransactionSource("email")).toBe("email");
  });

  it("maps newer sources for existing databases", () => {
    expect(databaseTransactionSource("siri")).toBe("shortcut");
    expect(databaseTransactionSource("text")).toBe("manual");
    expect(databaseTransactionSource("import")).toBe("manual");
  });
});
