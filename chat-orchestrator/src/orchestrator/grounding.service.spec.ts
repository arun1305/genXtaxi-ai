import { GroundingService } from './grounding.service';

/**
 * Grounding is a hard acceptance criterion (spec §2.9: "Zero currency amounts in
 * output that don't originate from a tool result").
 */
describe('GroundingService', () => {
  const service = new GroundingService();
  const allowed = [{ amount: 25000, currency: 'DZD' }]; // 250.00 DZD

  it('passes a reply with no monetary amounts', () => {
    const r = service.check('Your driver is 5 minutes away.', allowed);
    expect(r.grounded).toBe(true);
  });

  it('passes an amount that matches a tool result (major units)', () => {
    const r = service.check('The fare is 250 DZD.', allowed);
    expect(r.grounded).toBe(true);
  });

  it('passes the minor-unit form too', () => {
    const r = service.check('That is 25000 DZD in centimes.', allowed);
    expect(r.grounded).toBe(true);
  });

  it('BLOCKS an invented amount not present in any tool result', () => {
    const r = service.check('The fare is 999 DZD.', allowed);
    expect(r.grounded).toBe(false);
    expect(r.offendingAmounts.length).toBeGreaterThan(0);
  });

  it('blocks invented amounts even with a currency symbol', () => {
    const r = service.check('It costs €42 total.', allowed);
    expect(r.grounded).toBe(false);
  });

  it('handles thousands separators', () => {
    const r = service.check('Total: 250 DZD', [{ amount: 25000, currency: 'DZD' }]);
    expect(r.grounded).toBe(true);
  });
});
