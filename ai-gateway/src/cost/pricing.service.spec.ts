import { ModelRoute } from '@genxtaxi/ai-shared';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const service = new PricingService();
  const route: ModelRoute = {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    inputPricePerMillionUsd: 59, // $0.59 / 1M
    outputPricePerMillionUsd: 79, // $0.79 / 1M
  };

  it('prices tokens into USD micros and cents (no floats stored)', () => {
    const { money, usdMicros } = service.price(route, {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    // $0.59 (in) + $0.79 (out) per 1M => $1.38 => 138 cents => 1,380,000 micros
    expect(money.amount).toBe(138);
    expect(usdMicros).toBe(1_380_000);
    expect(money.currency).toBe('USD');
    expect(Number.isInteger(money.amount)).toBe(true);
  });

  it('returns zero cost when pricing is unset', () => {
    const { usdMicros } = service.price(
      { provider: 'x', model: 'y' },
      { inputTokens: 500, outputTokens: 500 },
    );
    expect(usdMicros).toBe(0);
  });
});
