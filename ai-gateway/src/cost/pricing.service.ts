import { Injectable } from '@nestjs/common';
import { Money, ModelRoute, TokenUsage } from '@genxtaxi/ai-shared';

/**
 * Prices token usage into money (spec §6 cost dashboard). Route pricing is
 * expressed in **USD cents per 1,000,000 tokens** (e.g. 59 => $0.59 / 1M).
 * Everything is integer to stay float-free:
 *   - `usdMicros`  : cost in USD micros (1 cent = 10,000 micros) — full precision
 *   - `money`      : {amount, currency} in USD cents (minor units)
 */
@Injectable()
export class PricingService {
  price(
    route: ModelRoute,
    usage: TokenUsage,
  ): { money: Money; usdMicros: number } {
    const inCents = route.inputPricePerMillionUsd ?? 0; // cents per 1M input tokens
    const outCents = route.outputPricePerMillionUsd ?? 0;

    // raw has units of (cents * tokens/1e6-implied); /100 converts to USD micros.
    const raw = usage.inputTokens * inCents + usage.outputTokens * outCents;
    const usdMicros = Math.round(raw / 100);
    const cents = Math.round(usdMicros / 10_000);
    return {
      money: { amount: cents, currency: 'USD' },
      usdMicros,
    };
  }
}
