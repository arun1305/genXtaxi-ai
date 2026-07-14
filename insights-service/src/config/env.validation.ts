import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8083),

  MONGODB_URI: z.string().startsWith('mongodb'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(8),
  JWT_ALGORITHM: z.string().default('HS256'),

  AI_GATEWAY_URL: z.string().default('http://localhost:8080'),
  INSIGHTS_SERVICE_TOKEN: z.string().optional().default(''),

  SUMMARY_MIN_NEW_REVIEWS: z.coerce.number().default(5),
  SUMMARY_MAX_AGE_HOURS: z.coerce.number().default(24),
  INGEST_CRON: z.string().default('*/5 * * * *'),
  ZONE_AGGREGATION_CRON: z.string().default('0 2 * * *'),
  COLD_START_MIN_REVIEWS: z.coerce.number().default(5),

  SUMMARY_PROMPT_VERSION: z.coerce.number().default(1),
  SUMMARY_TEMPERATURE: z.coerce.number().default(0.1),

  SUMMARY_CACHE_TTL_SECONDS: z.coerce.number().default(86_400),
  DEFAULT_LANG: z.string().default('fr'),
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
