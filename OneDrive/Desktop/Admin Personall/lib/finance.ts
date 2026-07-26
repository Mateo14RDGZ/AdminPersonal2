export type AvailabilityInput = {
  income: number;
  spent: number;
  reservedSavings: number;
  pendingRecurring?: number;
  upcomingPayments?: number;
  commitments?: number;
  daysRemaining: number;
};

export function calculateAvailability(input: AvailabilityInput) {
  const available =
    input.income -
    input.spent -
    input.reservedSavings -
    (input.pendingRecurring ?? 0) -
    (input.upcomingPayments ?? 0) -
    (input.commitments ?? 0);
  const safeAvailable = Math.max(0, available);
  const days = Math.max(1, Math.floor(input.daysRemaining));
  return {
    available,
    daily: safeAvailable / days,
    weekly: Math.min(safeAvailable, (safeAvailable / days) * 7),
  };
}

