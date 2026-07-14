import { isoWeek } from './iso-week';

describe('isoWeek', () => {
  it('formats an ISO week key', () => {
    // 2026-01-01 is a Thursday -> ISO week 1 of 2026
    expect(isoWeek(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
  });

  it('zero-pads single-digit weeks', () => {
    expect(isoWeek(new Date('2026-03-05T00:00:00Z'))).toMatch(/^2026-W\d{2}$/);
  });
});
