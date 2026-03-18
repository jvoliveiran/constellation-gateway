import gatewayConfig from './configuration';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should parse single subgraph', () => {
    process.env.SUBGRAPH = 'constellation|http://localhost:3001/graphql';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long';

    const config = gatewayConfig();

    expect(config.subgraphs).toEqual([
      { name: 'constellation', url: 'http://localhost:3001/graphql' },
    ]);
  });

  it('should parse multiple subgraphs', () => {
    process.env.SUBGRAPH =
      'constellation|http://localhost:3001/graphql,users|http://localhost:3002/graphql';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long';

    const config = gatewayConfig();

    expect(config.subgraphs).toHaveLength(2);
    expect(config.subgraphs[0].name).toBe('constellation');
    expect(config.subgraphs[1].name).toBe('users');
  });

  it('should use defaults when env vars are not set', () => {
    delete process.env.SERVICE_PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.RATE_LIMIT_TTL;

    const config = gatewayConfig();

    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe('info');
    expect(config.rateLimitTtl).toBe(60);
    expect(config.rateLimitMax).toBe(100);
    expect(config.queryMaxDepth).toBe(10);
    expect(config.subgraphTimeoutMs).toBe(30000);
  });

  it('should parse OTEL_SDK_DISABLED correctly', () => {
    process.env.OTEL_SDK_DISABLED = 'false';
    const config = gatewayConfig();
    expect(config.otelDisabled).toBe(false);

    process.env.OTEL_SDK_DISABLED = 'true';
    const config2 = gatewayConfig();
    expect(config2.otelDisabled).toBe(true);
  });

  it('should parse allowed origins', () => {
    process.env.ALLOWED_ORIGINS =
      'http://localhost:3002,https://app.example.com';

    const config = gatewayConfig();

    expect(config.allowedOrigins).toEqual([
      'http://localhost:3002',
      'https://app.example.com',
    ]);
  });
});
