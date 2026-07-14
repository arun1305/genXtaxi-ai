import { Injectable } from '@nestjs/common';

export interface FilterResult {
  clean: string;
  toxic: boolean;
  redactions: number;
}

/**
 * Toxicity + PII filter applied to each review before summarization (spec §3.3).
 * Masks PII and flags abusive content so it can be dropped/excluded, and never
 * surfaces a reviewer's identity in driver-facing output.
 */
@Injectable()
export class ContentFilterService {
  // Minimal multilingual profanity/abuse seed (FR/AR/EN). Extend via config.
  private static readonly TOXIC = [
    'idiot', 'stupid', 'trash', 'garbage',
    'connard', 'salaud', 'merde',
    'كلب', 'حقير', 'غبي',
  ];
  private static readonly PII = [
    /\b(?:\d[ -]?){13,19}\b/g, // card PAN
    /\b(?:\+?\d{1,3}[ -]?)?(?:\(?\d{2,4}\)?[ -]?){2,4}\d{2,4}\b/g, // phone
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // email
  ];

  filter(text: string): FilterResult {
    let clean = text ?? '';
    let redactions = 0;
    for (const re of ContentFilterService.PII) {
      clean = clean.replace(re, () => {
        redactions++;
        return '[REDACTED]';
      });
    }
    const lower = clean.toLowerCase();
    const toxic = ContentFilterService.TOXIC.some((w) => lower.includes(w));
    return { clean, toxic, redactions };
  }
}
