import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8081),

  MONGODB_URI: z.string().startsWith('mongodb'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(8),
  JWT_ALGORITHM: z.string().default('HS256'),
  JWT_ISSUER: z.string().default('genxtaxi'),

  FX_PROVIDER: z.string().default('exchangerate.host'),
  FX_API_URL: z.string().default('https://api.exchangerate.host/latest'),
  FX_API_KEY: z.string().optional().default(''),
  FX_BASE_CURRENCY: z.string().default('DZD'),
  FX_REFRESH_CRON: z.string().default('0 */6 * * *'),
  FX_CACHE_TTL_SECONDS: z.coerce.number().default(21_600),

  REPORTING_BASE_CURRENCY: z.string().default('USD'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
