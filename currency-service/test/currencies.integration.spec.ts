import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { RoundingRule } from '@genxtaxi/ai-shared';
import {
  Currency,
  CurrencySchema,
  CurrencyDocument,
} from '../src/schemas/currency.schema';
import { CurrenciesService } from '../src/currencies/currencies.service';

/**
 * Integration test: real Mongoose model against an in-memory MongoDB. Verifies
 * the seed of North/West Africa currencies and getConfig lookup (spec §1).
 */
describe('CurrenciesService (integration)', () => {
  let mongo: MongoMemoryServer;
  let service: CurrenciesService;
  let model: Model<CurrencyDocument>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        MongooseModule.forFeature([
          { name: Currency.name, schema: CurrencySchema },
        ]),
      ],
      providers: [CurrenciesService],
    }).compile();

    service = moduleRef.get(CurrenciesService);
    model = moduleRef.get(getModelToken(Currency.name));
    await service.onModuleInit(); // seed
  });

  afterAll(async () => {
    await mongo.stop();
  });

  it('seeds the default currencies on boot', async () => {
    const all = await service.findAll(true);
    const codes = all.map((c) => c.code).sort();
    expect(codes).toEqual(
      expect.arrayContaining(['DZD', 'EUR', 'USD', 'XOF', 'MAD', 'TND', 'NGN']),
    );
  });

  it('exposes correct minor-unit exponents (XOF = 0)', async () => {
    const xof = await service.getConfig('XOF');
    expect(xof.minorUnitExponent).toBe(0);
    const dzd = await service.getConfig('dzd');
    expect(dzd.minorUnitExponent).toBe(2);
  });

  it('upserts a new currency', async () => {
    await service.upsert({
      code: 'GHS',
      minorUnitExponent: 2,
      symbol: '₵',
      roundingRule: RoundingRule.HALF_UP,
      enabled: true,
    });
    const ghs = await service.getConfig('GHS');
    expect(ghs.symbol).toBe('₵');
  });
});
