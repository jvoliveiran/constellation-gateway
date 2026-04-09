import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  SERVICE_PORT: z.coerce.number().default(3000),
  SUBGRAPH: z
    .string()
    .regex(
      /^[\w-]+\|https?:\/\/[^\s,]+(,[\w-]+\|https?:\/\/[^\s,]+)*$/,
      'SUBGRAPH must follow the format: name|url (comma-separated for multiple)',
    ),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3002'),
  RATE_LIMIT_TTL: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  QUERY_MAX_DEPTH: z.coerce.number().default(10),
  QUERY_MAX_COMPLEXITY: z.coerce.number().min(1).default(1000),
  QUERY_DEFAULT_LIST_SIZE: z.coerce.number().min(1).default(50),
  QUERY_COMPLEXITY_WARN_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  SUBGRAPH_TIMEOUT_MS: z.coerce.number().default(30000),
  OTEL_SDK_DISABLED: z.coerce.boolean().default(true),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  return envSchema.parse(config);
}
