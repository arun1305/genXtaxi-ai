import { scanMoney } from './money-scan';

describe('scanMoney', () => {
  it('extracts canonical {amount, currency}', () => {
    expect(scanMoney({ fare: { amount: 25000, currency: 'DZD' } })).toEqual([
      { amount: 25000, currency: 'DZD' },
    ]);
  });

  it('extracts denormalized fee/total + currency sibling', () => {
    const out = scanMoney({ fee: 500, total: 3000, currency: 'dzd' });
    expect(out).toEqual(
      expect.arrayContaining([
        { amount: 500, currency: 'DZD' },
        { amount: 3000, currency: 'DZD' },
      ]),
    );
  });

  it('recurses into nested arrays/objects', () => {
    const out = scanMoney({
      rides: [{ receipt: { amount: 1200, currency: 'EUR' } }],
    });
    expect(out).toContainEqual({ amount: 1200, currency: 'EUR' });
  });

  it('returns empty for money-free payloads', () => {
    expect(scanMoney({ status: 'active', driver: 'Ali' })).toEqual([]);
  });
});
