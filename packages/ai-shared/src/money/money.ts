import {
  CurrencyCode,
  CurrencyConfig,
  FxRateSnapshot,
  Money,
  RoundingRule,
} from './currency.types';

/**
 * Guard rails and helpers for the {@link Money} value object.
 *
 * Design rules (spec §1):
 *  - Money is stored/transported as integer minor units. Floats are forbidden.
 *  - Conversion is for DISPLAY / reporting only; the authoritative amount stays
 *    in its original transaction currency. Callers must never silently mutate
 *    a settlement currency.
 *  - Rounding always goes through {@link roundMinor} so it is auditable.
 *
 * This class is intentionally free of NestJS/Mongoose imports so it can be
 * reused by every service and by plain unit tests.
 */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export const ISO_4217_REGEX = /^[A-Z]{3}$/;

export class MoneyOps {
  /** Validate and normalize a raw money-like object into a {@link Money}. */
  static of(amount: number, currency: CurrencyCode): Money {
    if (!Number.isInteger(amount)) {
      throw new MoneyError(
        `Money.amount must be an integer in minor units, received ${amount}`,
      );
    }
    const code = (currency ?? '').toUpperCase();
    if (!ISO_4217_REGEX.test(code)) {
      throw new MoneyError(`Invalid ISO 4217 currency code: "${currency}"`);
    }
    return Object.freeze({ amount, currency: code });
  }

  /** True when two Money values share a currency. */
  static sameCurrency(a: Money, b: Money): boolean {
    return a.currency.toUpperCase() === b.currency.toUpperCase();
  }

  /** Add two amounts of the SAME currency. Throws otherwise (no silent FX). */
  static add(a: Money, b: Money): Money {
    if (!MoneyOps.sameCurrency(a, b)) {
      throw new MoneyError(
        `Cannot add ${a.currency} to ${b.currency} without an explicit conversion`,
      );
    }
    return MoneyOps.of(a.amount + b.amount, a.currency);
  }

  /**
   * Apply a currency-agnostic multiplier (e.g. surge — spec §1: surge never
   * changes the currency, only the amount) and round to minor units.
   */
  static multiply(m: Money, factor: number, cfg: CurrencyConfig): Money {
    if (!Number.isFinite(factor) || factor < 0) {
      throw new MoneyError(`Invalid multiplier: ${factor}`);
    }
    const raw = m.amount * factor;
    return MoneyOps.of(MoneyOps.roundMinor(raw, cfg.roundingRule), m.currency);
  }

  /** Round a fractional minor-unit value to an integer per the rule. */
  static roundMinor(value: number, rule: RoundingRule): number {
    switch (rule) {
      case RoundingRule.DOWN:
        return Math.trunc(value);
      case RoundingRule.HALF_UP:
        return Math.sign(value) * Math.round(Math.abs(value));
      case RoundingRule.HALF_EVEN: {
        const floor = Math.floor(value);
        const diff = value - floor;
        if (diff < 0.5) return floor;
        if (diff > 0.5) return floor + 1;
        return floor % 2 === 0 ? floor : floor + 1;
      }
      default:
        return Math.round(value);
    }
  }

  /**
   * Convert `money` (in `from` currency) into the `to` currency for DISPLAY.
   * The FX rate + timestamp used are returned so callers can persist both the
   * original and converted values (spec §1 admin/reporting normalization).
   */
  static convert(
    money: Money,
    fx: FxRateSnapshot,
    fromCfg: CurrencyConfig,
    toCfg: CurrencyConfig,
  ): { converted: Money; rateTimestamp: string } {
    if (money.currency.toUpperCase() !== fx.base.toUpperCase()) {
      throw new MoneyError(
        `FX base ${fx.base} does not match money currency ${money.currency}`,
      );
    }
    // minor -> major -> apply rate -> major -> minor of target
    const major = money.amount / 10 ** fromCfg.minorUnitExponent;
    const convertedMajor = major * fx.rate;
    const convertedMinorRaw = convertedMajor * 10 ** toCfg.minorUnitExponent;
    const converted = MoneyOps.of(
      MoneyOps.roundMinor(convertedMinorRaw, toCfg.roundingRule),
      toCfg.code,
    );
    return { converted, rateTimestamp: fx.rateTimestamp };
  }

  /**
   * Format for the frontend. Mirrors the spec's guidance to use
   * Intl.NumberFormat(locale, { style: 'currency', currency }) — provided here
   * for server-side rendering / receipts. RTL handling is a frontend concern.
   */
  static format(money: Money, cfg: CurrencyConfig, locale = 'fr-DZ'): string {
    const major = money.amount / 10 ** cfg.minorUnitExponent;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: cfg.minorUnitExponent,
      maximumFractionDigits: cfg.minorUnitExponent,
    }).format(major);
  }
}
