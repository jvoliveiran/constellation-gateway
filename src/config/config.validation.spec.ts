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

  it('should accept missing SUBGRAPH (optional for runtime)', () => {
    const configWithoutSubgraph = Object.fromEntries(
      Object.entries(validConfig).filter(([key]) => key !== 'SUBGRAPH'),
    );
    const result = envSchema.safeParse(configWithoutSubgraph);
    expect(result.success).toBe(true);
  });

  it('should reject malformed SUBGRAPH', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      SUBGRAPH: 'invalid-format',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing JWT_SECRET', () => {
    const configWithoutSecret = Object.fromEntries(
      Object.entries(validConfig).filter(([key]) => key !== 'JWT_SECRET'),
    );
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

  it('should default SUPERGRAPH_PATH to ./supergraph.graphql', () => {
    const result = envSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPERGRAPH_PATH).toBe('./supergraph.graphql');
    }
  });

  it('should accept a custom SUPERGRAPH_PATH', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      SUPERGRAPH_PATH: '/opt/gateway/supergraph.graphql',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPERGRAPH_PATH).toBe(
        '/opt/gateway/supergraph.graphql',
      );
    }
  });

  it('should apply defaults for optional fields', () => {
    const result = envSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RATE_LIMIT_TTL).toBe(60);
      expect(result.data.RATE_LIMIT_MAX).toBe(100);
      expect(result.data.QUERY_MAX_DEPTH).toBe(10);
      expect(result.data.QUERY_MAX_COMPLEXITY).toBe(1000);
      expect(result.data.QUERY_DEFAULT_LIST_SIZE).toBe(50);
      expect(result.data.QUERY_COMPLEXITY_WARN_THRESHOLD).toBe(0.8);
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

  it('should reject QUERY_MAX_COMPLEXITY less than 1', () => {
    const zeroResult = envSchema.safeParse({
      ...validConfig,
      QUERY_MAX_COMPLEXITY: 0,
    });
    expect(zeroResult.success).toBe(false);

    const negativeResult = envSchema.safeParse({
      ...validConfig,
      QUERY_MAX_COMPLEXITY: -5,
    });
    expect(negativeResult.success).toBe(false);
  });

  it('should reject QUERY_DEFAULT_LIST_SIZE less than 1', () => {
    const zeroResult = envSchema.safeParse({
      ...validConfig,
      QUERY_DEFAULT_LIST_SIZE: 0,
    });
    expect(zeroResult.success).toBe(false);

    const negativeResult = envSchema.safeParse({
      ...validConfig,
      QUERY_DEFAULT_LIST_SIZE: -10,
    });
    expect(negativeResult.success).toBe(false);
  });

  it('should reject QUERY_COMPLEXITY_WARN_THRESHOLD outside 0-1 range', () => {
    const aboveOneResult = envSchema.safeParse({
      ...validConfig,
      QUERY_COMPLEXITY_WARN_THRESHOLD: 1.5,
    });
    expect(aboveOneResult.success).toBe(false);

    const negativeResult = envSchema.safeParse({
      ...validConfig,
      QUERY_COMPLEXITY_WARN_THRESHOLD: -0.1,
    });
    expect(negativeResult.success).toBe(false);
  });

  it('should accept valid custom complexity configuration', () => {
    const result = envSchema.safeParse({
      ...validConfig,
      QUERY_MAX_COMPLEXITY: 500,
      QUERY_DEFAULT_LIST_SIZE: 25,
      QUERY_COMPLEXITY_WARN_THRESHOLD: 0.9,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.QUERY_MAX_COMPLEXITY).toBe(500);
      expect(result.data.QUERY_DEFAULT_LIST_SIZE).toBe(25);
      expect(result.data.QUERY_COMPLEXITY_WARN_THRESHOLD).toBe(0.9);
    }
  });
});
