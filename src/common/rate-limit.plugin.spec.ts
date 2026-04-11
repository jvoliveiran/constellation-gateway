import {
  createRateLimitPlugin,
  clearRateLimitStore,
} from './rate-limit.plugin';
import { GraphQLRequestListener } from '@apollo/server';

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  fatal: jest.fn(),
};

function createMockRequestContext(ip: string) {
  return {
    contextValue: { clientIp: ip },
    request: { query: '{ users { id } }' },
    schema: {},
  };
}

async function executeRequest(
  plugin: ReturnType<typeof createRateLimitPlugin>,
  ip: string,
): Promise<void> {
  const requestDidStart = plugin.requestDidStart!;
  const listener = (await requestDidStart(
    createMockRequestContext(ip) as never,
  )) as GraphQLRequestListener<Record<string, unknown>>;

  if (listener?.didResolveOperation) {
    await listener.didResolveOperation({
      document: {} as never,
      operationName: 'test',
      operation: {} as never,
      request: { query: '{ users { id } }' },
      metrics: {} as never,
      queryHash: '',
      source: '',
      contextValue: { clientIp: ip },
      schema: {} as never,
      logger: {} as never,
      overallCachePolicy: {} as never,
      requestIsBatched: false,
    } as never);
  }
}

describe('createRateLimitPlugin', () => {
  beforeEach(() => {
    clearRateLimitStore();
    jest.clearAllMocks();
  });

  it('allows requests within the rate limit', async () => {
    const plugin = createRateLimitPlugin({ ttl: 60, max: 5 }, mockLogger);

    for (let i = 0; i < 5; i++) {
      await expect(executeRequest(plugin, '10.0.0.1')).resolves.not.toThrow();
    }
  });

  it('throws RATE_LIMITED error when limit is exceeded', async () => {
    const plugin = createRateLimitPlugin({ ttl: 60, max: 3 }, mockLogger);

    for (let i = 0; i < 3; i++) {
      await executeRequest(plugin, '10.0.0.2');
    }

    await expect(executeRequest(plugin, '10.0.0.2')).rejects.toThrow(
      'Too many requests',
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit exceeded'),
      expect.objectContaining({ ip: '10.0.0.2' }),
    );
  });

  it('resets the counter after the TTL window expires', async () => {
    const plugin = createRateLimitPlugin({ ttl: 1, max: 2 }, mockLogger);

    await executeRequest(plugin, '10.0.0.3');
    await executeRequest(plugin, '10.0.0.3');

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await expect(executeRequest(plugin, '10.0.0.3')).resolves.not.toThrow();
  });

  it('tracks different IPs independently', async () => {
    const plugin = createRateLimitPlugin({ ttl: 60, max: 2 }, mockLogger);

    await executeRequest(plugin, '10.0.0.4');
    await executeRequest(plugin, '10.0.0.4');

    // IP B should still be allowed
    await expect(executeRequest(plugin, '10.0.0.5')).resolves.not.toThrow();

    // IP A should be rejected
    await expect(executeRequest(plugin, '10.0.0.4')).rejects.toThrow(
      'Too many requests',
    );
  });
});
