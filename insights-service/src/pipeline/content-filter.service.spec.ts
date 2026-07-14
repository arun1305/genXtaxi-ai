import { ContentFilterService } from './content-filter.service';

describe('ContentFilterService', () => {
  const service = new ContentFilterService();

  it('redacts PII (phone/email) from review text', () => {
    const { clean, redactions } = service.filter('call me 0555 12 34 56 or a@b.com');
    expect(clean).toContain('[REDACTED]');
    expect(clean).not.toContain('a@b.com');
    expect(redactions).toBeGreaterThanOrEqual(1);
  });

  it('flags toxic content', () => {
    expect(service.filter('the driver is an idiot').toxic).toBe(true);
    expect(service.filter('great ride, very clean').toxic).toBe(false);
  });
});
