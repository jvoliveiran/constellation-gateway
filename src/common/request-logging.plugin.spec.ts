import { LoggerService } from '@nestjs/common';
import {
  createRequestLoggingPlugin,
  hashQuery,
} from './request-logging.plugin';

function createMockLogger(): LoggerService & {
  log: jest.Mock;
  debug: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
} {
  return {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
}

type ContextValue = {
  userId?: string;
  correlationId?: string;
  clientIp?: string;
};

async function executePlugin(
  logger: LoggerService,
  options: {
    contextValue?: ContextValue;
    query?: string;
    operationName?: string | null;
    operationType?: string;
    responseBody?: Record<string, unknown>;
  } = {},
) {
  const plugin = createRequestLoggingPlugin(logger);

  const requestContext = {
    contextValue: options.contextValue ?? {
      userId: 'user-1',
      correlationId: 'corr-1',
      clientIp: '127.0.0.1',
    },
    request: {
      query: options.query ?? '{ users { id } }',
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listener = await (plugin as any).requestDidStart(requestContext);

  const responseContext = {
    operationName:
      options.operationName === undefined ? 'GetUsers' : options.operationName,
    operation: options.operationType
      ? { operation: options.operationType }
      : { operation: 'query' },
    response: {
      body: {
        kind: 'single',
        singleResult: options.responseBody ?? { data: { users: [] } },
      },
    },
  };

  await listener.willSendResponse(responseContext);
}

describe('createRequestLoggingPlugin', () => {
  it('logs a successful request at info level with all fields', async () => {
    const logger = createMockLogger();

    await executePlugin(logger, {
      contextValue: {
        userId: 'user-42',
        correlationId: 'abc-123',
        clientIp: '10.0.0.1',
      },
      query: '{ users { id name } }',
      operationName: 'GetUsers',
      operationType: 'query',
    });

    expect(logger.log).toHaveBeenCalledTimes(1);
    const [message, meta] = logger.log.mock.calls[0];
    expect(message).toBe('GraphQL request completed');
    expect(meta.operationName).toBe('GetUsers');
    expect(meta.operationType).toBe('query');
    expect(meta.queryHash).toHaveLength(16);
    expect(meta.durationMs).toBeGreaterThanOrEqual(0);
    expect(meta.errorCount).toBe(0);
    expect(meta.errors).toBeUndefined();
    expect(meta.userId).toBe('user-42');
    expect(meta.correlationId).toBe('abc-123');
    expect(meta.clientIp).toBe('10.0.0.1');
  });

  it('logs request with errors including error details', async () => {
    const logger = createMockLogger();

    await executePlugin(logger, {
      responseBody: {
        data: null,
        errors: [
          {
            message: 'Not found',
            extensions: { code: 'NOT_FOUND' },
          },
          {
            message: 'Forbidden',
            extensions: { code: 'FORBIDDEN' },
          },
        ],
      },
    });

    expect(logger.log).toHaveBeenCalledTimes(1);
    const [message, meta] = logger.log.mock.calls[0];
    expect(message).toBe('GraphQL request completed with errors');
    expect(meta.errorCount).toBe(2);
    expect(meta.errors).toEqual([
      { message: 'Not found', code: 'NOT_FOUND' },
      { message: 'Forbidden', code: 'FORBIDDEN' },
    ]);
  });

  it('logs introspection queries at debug level', async () => {
    const logger = createMockLogger();

    await executePlugin(logger, {
      operationName: 'IntrospectionQuery',
      query: '{ __schema { types { name } } }',
    });

    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
    const [message] = logger.debug.mock.calls[0];
    expect(message).toBe('GraphQL request completed');
  });

  it('logs __schema queries without IntrospectionQuery name at debug level', async () => {
    const logger = createMockLogger();

    await executePlugin(logger, {
      operationName: null,
      query: '{ __schema { queryType { name } } }',
    });

    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('uses "anonymous" when operationName is null', async () => {
    const logger = createMockLogger();

    await executePlugin(logger, {
      operationName: null,
      query: '{ users { id } }',
    });

    const [, meta] = logger.log.mock.calls[0];
    expect(meta.operationName).toBe('anonymous');
  });

  it('logs userId as undefined for public operations', async () => {
    const logger = createMockLogger();

    await executePlugin(logger, {
      contextValue: {
        userId: undefined,
        correlationId: 'corr-1',
        clientIp: '10.0.0.1',
      },
    });

    const [, meta] = logger.log.mock.calls[0];
    expect(meta.userId).toBeUndefined();
  });

  it('produces a deterministic 16-char hex query hash', () => {
    const query = '{ users { id name } }';
    const hash1 = hashQuery(query);
    const hash2 = hashQuery(query);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
    expect(hash1).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces different hashes for different queries', () => {
    const hash1 = hashQuery('{ users { id } }');
    const hash2 = hashQuery('{ orders { id } }');

    expect(hash1).not.toBe(hash2);
  });
});
