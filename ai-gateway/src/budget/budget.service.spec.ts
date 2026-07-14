import { ConfigService } from '@nestjs/config';
import RedisMock from 'ioredis-mock';
import { BudgetExceededError } from '@genxtaxi/ai-shared';
import { BudgetService } from './budget.service';

describe('BudgetService', () => {
  let service: BudgetService;
  let redis: InstanceType<typeof RedisMock>;

  const config = {
    get: (key: string) =>
      key === 'DAILY_TOKEN_BUDGET_PER_USER' ? 1000 : undefined,
  } as unknown as ConfigService<Record<string, unknown>, true>;

  beforeEach(() => {
    redis = new RedisMock();
    service = new BudgetService(config, redis as never);
  });

  it('allows a user under budget', async () => {
    await expect(service.assertWithinBudget('u1')).resolves.toBeUndefined();
  });

  it('accumulates consumption and reports remaining', async () => {
    await service.consume('u1', 400);
    await service.consume('u1', 300);
    expect(await service.remaining('u1')).toBe(300);
  });

  it('throws once the daily budget is exhausted', async () => {
    await service.consume('u1', 1000);
    await expect(service.assertWithinBudget('u1')).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
  });

  it('isolates budgets per user', async () => {
    await service.consume('u1', 1000);
    await expect(service.assertWithinBudget('u2')).resolves.toBeUndefined();
  });
});
