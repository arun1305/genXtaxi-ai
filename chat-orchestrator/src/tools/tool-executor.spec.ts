import { Role } from '@genxtaxi/ai-shared';
import { ToolExecutorService } from './tool-executor.service';
import { ToolContext } from './tool.types';

/** Server-side authz + schema validation are security-critical (spec §2.4/§2.8). */
describe('ToolExecutorService authorization', () => {
  const core = { request: jest.fn().mockResolvedValue({ ok: true, data: {} }) };
  const models = {} as never;
  const redis = {} as never;
  const service = new ToolExecutorService(core as never, models, models, redis);

  const driverCtx: ToolContext = {
    user: { userId: 'd1', role: Role.DRIVER, token: 't' },
    sessionId: '000000000000000000000000',
    lang: 'fr',
    traceId: 'tr',
  };
  const passengerCtx: ToolContext = {
    ...driverCtx,
    user: { userId: 'p1', role: Role.PASSENGER, token: 't' },
  };

  it('rejects a driver invoking book_ride (passenger-only)', async () => {
    await expect(
      service.execute('book_ride', { pickup: 'a', dropoff: 'b', ride_type: 'economy' }, driverCtx),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown tool', async () => {
    await expect(service.execute('drop_database', {}, passengerCtx)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('rejects missing required args', async () => {
    await expect(
      service.execute('get_fare_estimate', { pickup: 'a' }, passengerCtx),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('allows a permitted read-only tool through to the core backend', async () => {
    const out = await service.execute(
      'get_fare_estimate',
      { pickup: '36.75,3.05', dropoff: '36.70,3.10', ride_type: 'economy' },
      passengerCtx,
    );
    expect(out.kind).toBe('result');
    expect(core.request).toHaveBeenCalledWith(
      'POST',
      '/rides/estimate',
      't',
      expect.objectContaining({ rideType: 'economy' }),
    );
  });
});
