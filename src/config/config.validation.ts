import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  SERVICE_PORT: Joi.number().default(3000),
  SUBGRAPH: Joi.string()
    .required()
    .pattern(/^[\w-]+\|https?:\/\/[^\s,]+(,[\w-]+\|https?:\/\/[^\s,]+)*$/),
  JWT_SECRET: Joi.string().required().min(32),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3002'),
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),
  QUERY_MAX_DEPTH: Joi.number().default(10),
  SUBGRAPH_TIMEOUT_MS: Joi.number().default(30000),
  OTEL_SDK_DISABLED: Joi.boolean().default(true),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: Joi.string().optional(),
});
