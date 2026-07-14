import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8082),

  MONGODB_URI: z.string().startsWith('mongodb'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(8),
  JWT_ALGORITHM: z.string().default('HS256'),

  AI_GATEWAY_URL: z.string().default('http://localhost:8080'),
  GEN_TAXI_BACKEND_URL: z.string().default('http://localhost:5001'),
  CURRENCY_SERVICE_URL: z.string().default('http://localhost:8081'),

  MAX_TOOL_HOPS: z.coerce.number().default(5),
  SESSION_CONTEXT_TURNS: z.coerce.number().default(10),
  CHAT_RETENTION_DAYS: z.coerce.number().default(90),

  REFUND_MAX_PER_DAY: z.coerce.number().default(3),
  CONFIRM_TTL_SECONDS: z.coerce.number().default(300),

  MARKET: z.string().default('Algeria'),
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
