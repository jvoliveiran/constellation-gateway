import { envSchema } from './config.validation';

describe('Config Validation', () => {
  const validConfig = {
    NODE_ENV: 'development',
    SERVICE_PORT: 3000,
    SUBGRAPH: 'constellation|http://localhost:3001/graphql',
    JWT_SECRET: 'a-very-long-secret-key-at-least-32-chars',
    LOG_LEVEL: 'debug',
    ALLOWED_ORIGINS: 'http://localhost:3002',
  };

  it('should accept valid configuration', () => {
    const result = envSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject missing SUBGRAPH', () => {
    const { SUBGRAPH: _, ...configWithoutSubgraph } = validConfig;
    const result = envSchema.safeParse(configWithoutSubgraph);
    expect(result.success).toBe(false);
  });

  it('should reject malformed SUBGRAPH', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      SUBGRAPH: 'invalid-format',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing JWT_SECRET', () => {
    const { JWT_SECRET: _, ...configWithoutSecret } = validConfig;
    const result = envSchema.safeParse(configWithoutSecret);
    expect(result.success).toBe(false);
  });

  it('should reject JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      JWT_SECRET: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('should accept multiple subgraphs', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      SUBGRAPH:
        'constellation|http://localhost:3001/graphql,users|http://localhost:3002/graphql',
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults for optional fields', () => {
    const result = envSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RATE_LIMIT_TTL).toBe(60);
      expect(result.data.RATE_LIMIT_MAX).toBe(100);
      expect(result.data.QUERY_MAX_DEPTH).toBe(10);
      expect(result.data.SUBGRAPH_TIMEOUT_MS).toBe(30000);
      expect(result.data.OTEL_SDK_DISABLED).toBe(true);
    }
  });

  it('should reject invalid NODE_ENV', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      NODE_ENV: 'staging',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid LOG_LEVEL', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      LOG_LEVEL: 'verbose',
    });
    expect(result.success).toBe(false);
  });
});
