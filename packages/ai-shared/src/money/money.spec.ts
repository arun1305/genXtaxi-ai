import { MoneyOps, MoneyError } from './money';
import { CurrencyConfig, RoundingRule, FxRateSnapshot } from './currency.types';

const DZD: CurrencyConfig = {
  code: 'DZD',
  minorUnitExponent: 2,
  roundingRule: RoundingRule.HALF_EVEN,
  symbol: 'DA',
  enabled: true,
};
const XOF: CurrencyConfig = {
  code: 'XOF',
  minorUnitExponent: 0,
  roundingRule: RoundingRule.HALF_UP,
  symbol: 'CFA',
  enabled: true,
};

describe('MoneyOps', () => {
  it('rejects non-integer minor units', () => {
    expect(() => MoneyOps.of(250.5, 'DZD')).toThrow(MoneyError);
  });

  it('rejects invalid ISO codes', () => {
    expect(() => MoneyOps.of(100, 'dzdd')).toThrow(MoneyError);
  });

  it('normalizes currency to upper case', () => {
    expect(MoneyOps.of(25000, 'dzd')).toEqual({ amount: 25000, currency: 'DZD' });
  });

  it('refuses cross-currency addition (no silent FX)', () => {
    expect(() =>
      MoneyOps.add({ amount: 100, currency: 'DZD' }, { amount: 100, currency: 'EUR' }),
    ).toThrow(MoneyError);
  });

  it('applies a surge multiplier without changing currency', () => {
    const surged = MoneyOps.multiply({ amount: 25000, currency: 'DZD' }, 1.4, DZD);
    expect(surged).toEqual({ amount: 35000, currency: 'DZD' });
  });

  it('converts DZD -> XOF for display and returns the rate timestamp', () => {
    const fx: FxRateSnapshot = {
      base: 'DZD',
      quote: 'XOF',
      rate: 4.5,
      rateTimestamp: '2026-07-07T00:00:00.000Z',
      provider: 'exchangerate.host',
    };
    const { converted, rateTimestamp } = MoneyOps.convert(
      { amount: 25000, currency: 'DZD' }, // 250.00 DZD
      fx,
      DZD,
      XOF,
    );
    // 250.00 * 4.5 = 1125 XOF (exponent 0)
    expect(converted).toEqual({ amount: 1125, currency: 'XOF' });
    expect(rateTimestamp).toBe('2026-07-07T00:00:00.000Z');
  });

  it('HALF_EVEN rounds bankers-style', () => {
    expect(MoneyOps.roundMinor(2.5, RoundingRule.HALF_EVEN)).toBe(2);
    expect(MoneyOps.roundMinor(3.5, RoundingRule.HALF_EVEN)).toBe(4);
  });
});
