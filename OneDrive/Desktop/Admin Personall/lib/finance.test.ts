import { describe, expect, it } from "vitest";
import { calculateAvailability } from "./finance";

describe("calculateAvailability", () => {
  it("subtracts savings, spending and future commitments once", () => {
    expect(
      calculateAvailability({
        income: 50_000,
        spent: 10_000,
        reservedSavings: 5_000,
        pendingRecurring: 2_000,
        upcomingPayments: 3_000,
        daysRemaining: 10,
      })
    ).toEqual({ available: 30_000, daily: 3_000, weekly: 21_000 });
  });

  it("never recommends negative daily spending", () => {
    const result = calculateAvailability({
      income: 1_000,
      spent: 2_000,
      reservedSavings: 0,
      daysRemaining: 0,
    });
    expect(result.available).toBe(-1_000);
    expect(result.daily).toBe(0);
    expect(result.weekly).toBe(0);
  });
});

