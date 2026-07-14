import { z } from 'zod';

/**
 * Fail-fast environment validation (spec §5: config-driven, no inline secrets).
 * Parsed once at bootstrap; the typed object is exposed via ConfigService.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),

  MONGODB_URI: z.string().url().or(z.string().startsWith('mongodb')),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(8),
  JWT_ALGORITHM: z.string().default('HS256'),
  JWT_ISSUER: z.string().default('genxtaxi'),

  GROQ_API_KEY: z.string().optional().default(''),
  // Host only — the groq-sdk appends /openai/v1/chat/completions itself.
  GROQ_BASE_URL: z.string().default('https://api.groq.com'),
  LLM_CHAT_MODEL: z.string().default('llama-3.3-70b-versatile'),
  LLM_CHEAP_MODEL: z.string().default('llama-3.1-8b-instant'),

  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_FALLBACK_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  EMBEDDING_PROVIDER: z.string().default('cohere'),
  COHERE_API_KEY: z.string().optional().default(''),
  EMBEDDING_MODEL: z.string().default('embed-multilingual-v3.0'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024),

  DAILY_TOKEN_BUDGET_PER_USER: z.coerce.number().default(100_000),
  THROTTLE_TTL_SECONDS: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(60),
  AI_LOG_RETENTION_DAYS: z.coerce.number().default(90),

  CURRENCY_SERVICE_URL: z.string().default('http://localhost:8081'),
  REPORTING_BASE_CURRENCY: z.string().default('USD'),

  CB_TIMEOUT_MS: z.coerce.number().default(15_000),
  CB_ERROR_THRESHOLD_PERCENT: z.coerce.number().default(50),
  CB_RESET_TIMEOUT_MS: z.coerce.number().default(30_000),
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
