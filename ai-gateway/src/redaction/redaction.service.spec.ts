import { RedactionService } from './redaction.service';

describe('RedactionService', () => {
  const service = new RedactionService();

  it('redacts a card PAN', () => {
    const { text, redactions } = service.scrub('My card is 4111 1111 1111 1111');
    expect(text).toContain('[REDACTED_CARD]');
    expect(text).not.toContain('4111');
    expect(redactions.find((r) => r.type === 'card_pan')?.count).toBe(1);
  });

  it('redacts phone numbers', () => {
    const { text } = service.scrub('Call me on +213 555 12 34 56');
    expect(text).toContain('[REDACTED_PHONE]');
  });

  it('redacts precise GPS coordinates', () => {
    const { text } = service.scrub('I am at 36.75340, 3.05880 right now');
    expect(text).toContain('[REDACTED_GPS]');
  });

  it('redacts email addresses', () => {
    const { text } = service.scrub('email me rider@example.com');
    expect(text).toContain('[REDACTED_EMAIL]');
  });

  it('leaves clean text untouched', () => {
    const input = 'Where is my driver?';
    expect(service.scrub(input).text).toBe(input);
  });
});
