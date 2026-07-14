import { Injectable } from '@nestjs/common';

export interface RedactionResult {
  text: string;
  redactions: { type: string; count: number }[];
}

/**
 * PII redaction layer (spec §1 Data & privacy, §5). Scrubs phone numbers, exact
 * GPS coordinates and card fragments BEFORE any content leaves our infra to a
 * provider. Deterministic + logged (counts only, never the raw values).
 *
 * This is defense-in-depth; structured tool args carry the real identifiers
 * server-side and are never sent verbatim to the model.
 */
@Injectable()
export class RedactionService {
  // Order matters: card PAN before generic long-number/phone patterns.
  private readonly patterns: { type: string; re: RegExp; replacement: string }[] = [
    {
      type: 'card_pan',
      re: /\b(?:\d[ -]?){13,19}\b/g,
      replacement: '[REDACTED_CARD]',
    },
    {
      type: 'phone',
      re: /\b(?:\+?\d{1,3}[ -]?)?(?:\(?\d{2,4}\)?[ -]?){2,4}\d{2,4}\b/g,
      replacement: '[REDACTED_PHONE]',
    },
    {
      type: 'gps',
      re: /[-+]?\d{1,3}\.\d{4,},\s*[-+]?\d{1,3}\.\d{4,}/g,
      replacement: '[REDACTED_GPS]',
    },
    {
      type: 'email',
      re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      replacement: '[REDACTED_EMAIL]',
    },
  ];

  scrub(text: string): RedactionResult {
    let out = text;
    const redactions: { type: string; count: number }[] = [];
    for (const { type, re, replacement } of this.patterns) {
      const matches = out.match(re);
      if (matches?.length) {
        redactions.push({ type, count: matches.length });
        out = out.replace(re, replacement);
      }
    }
    return { text: out, redactions };
  }
}
