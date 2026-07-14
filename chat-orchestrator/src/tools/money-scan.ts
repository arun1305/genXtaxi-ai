export interface ScannedMoney {
  amount: number;
  currency: string;
}

/**
 * Recursively extract every {amount, currency} money pair from a tool result.
 * Used by the grounding check (spec §2.4): the final reply may only contain
 * currency amounts that originate from a tool result.
 */
export function scanMoney(value: unknown, acc: ScannedMoney[] = []): ScannedMoney[] {
  if (!value || typeof value !== 'object') return acc;

  if (Array.isArray(value)) {
    for (const v of value) scanMoney(v, acc);
    return acc;
  }

  const obj = value as Record<string, unknown>;
  // Canonical {amount, currency}
  if (typeof obj.amount === 'number' && typeof obj.currency === 'string') {
    acc.push({ amount: obj.amount, currency: obj.currency.toUpperCase() });
  }
  // Common denormalized shapes: fee/fare/total + currency sibling
  const currency = typeof obj.currency === 'string' ? obj.currency.toUpperCase() : undefined;
  if (currency) {
    for (const key of ['fee', 'fare', 'total', 'subtotal', 'surgeAmount', 'refund']) {
      if (typeof obj[key] === 'number') {
        acc.push({ amount: obj[key] as number, currency });
      }
    }
  }
  for (const v of Object.values(obj)) scanMoney(v, acc);
  return acc;
}
