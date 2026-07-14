/**
 * Currency primitives shared across all GenXTaxi AI services.
 *
 * Spec §1 (Money & multi-currency): every monetary value is
 *   { amount: <integer minor units>, currency: <ISO 4217 code> }
 * e.g. { amount: 25000, currency: "DZD" } === 250.00 DZD.
 *
 * Money is NEVER represented as a float anywhere in the platform.
 */

/** ISO 4217 alpha-3 currency code (validated at the service boundary, not by the type). */
export type CurrencyCode = string;

/**
 * The canonical monetary shape. `amount` is an integer in the currency's
 * minor units (e.g. cents for DZD/EUR/USD which have exponent 2, or whole
 * units for XOF which has exponent 0).
 */
export interface Money {
  /** Integer minor units. Fractional values are a programming error. */
  readonly amount: number;
  /** ISO 4217 code, upper-cased. */
  readonly currency: CurrencyCode;
}

/** Per-currency configuration owned by the currency-service (spec §1). */
export interface CurrencyConfig {
  readonly code: CurrencyCode;
  /** Number of decimal places: DZD/EUR/USD = 2, XOF = 0, … */
  readonly minorUnitExponent: number;
  /** Rounding rule applied when converting/formatting. */
  readonly roundingRule: RoundingRule;
  readonly symbol: string;
  readonly enabled: boolean;
}

export enum RoundingRule {
  HALF_EVEN = 'HALF_EVEN',
  HALF_UP = 'HALF_UP',
  DOWN = 'DOWN',
}

/**
 * An FX rate snapshot. Immutable once issued; `rateTimestamp` is stamped onto
 * any quote/refund/report that used it (spec §1, §4.7).
 */
export interface FxRateSnapshot {
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
  /** Multiply a `base` major-unit amount by this to get `quote` major units. */
  readonly rate: number;
  readonly rateTimestamp: string; // ISO date
  readonly provider: string;
}
