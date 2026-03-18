import { validationSchema } from './config.validation';

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
    const { error } = validationSchema.validate(validConfig);
    expect(error).toBeUndefined();
  });

  it('should reject missing SUBGRAPH', () => {
    const { error } = validationSchema.validate({
      ...validConfig,
      SUBGRAPH: undefined,
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('SUBGRAPH');
  });

  it('should reject malformed SUBGRAPH', () => {
    const { error } = validationSchema.validate({
      ...validConfig,
      SUBGRAPH: 'invalid-format',
    });
    expect(error).toBeDefined();
  });

  it('should reject missing JWT_SECRET', () => {
    const { error } = validationSchema.validate({
      ...validConfig,
      JWT_SECRET: undefined,
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_SECRET');
  });

  it('should reject JWT_SECRET shorter than 32 characters', () => {
    const { error } = validationSchema.validate({
      ...validConfig,
      JWT_SECRET: 'short',
    });
    expect(error).toBeDefined();
  });

  it('should accept multiple subgraphs', () => {
    const { error } = validationSchema.validate({
      ...validConfig,
      SUBGRAPH:
        'constellation|http://localhost:3001/graphql,users|http://localhost:3002/graphql',
    });
    expect(error).toBeUndefined();
  });

  it('should apply defaults for optional fields', () => {
    const { value } = validationSchema.validate(validConfig);
    expect(value.RATE_LIMIT_TTL).toBe(60);
    expect(value.RATE_LIMIT_MAX).toBe(100);
    expect(value.QUERY_MAX_DEPTH).toBe(10);
    expect(value.SUBGRAPH_TIMEOUT_MS).toBe(30000);
    expect(value.OTEL_SDK_DISABLED).toBe(true);
  });

  it('should reject invalid NODE_ENV', () => {
    const { error } = validationSchema.validate({
      ...validConfig,
      NODE_ENV: 'staging',
    });
    expect(error).toBeDefined();
  });

  it('should reject invalid LOG_LEVEL', () => {
    const { error } = validationSchema.validate({
      ...validConfig,
      LOG_LEVEL: 'verbose',
    });
    expect(error).toBeDefined();
  });
});
