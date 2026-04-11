const mockAdd = jest.fn();

jest.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createCounter: () => ({ add: mockAdd }),
    }),
  },
}));

import { createResponseCacheMetricsPlugin } from './response-cache-metrics.plugin';
import { GraphQLRequestListener } from '@apollo/server';

function createMockRequestContext(ageHeader: string | null, maxAge?: number) {
  const headers = new Map<string, string>();
  if (ageHeader) headers.set('age', ageHeader);

  return {
    operationName: 'TestQuery',
    response: {
      http: { headers },
    },
    overallCachePolicy: {
      maxAge: maxAge ?? 0,
    },
  };
}

describe('createResponseCacheMetricsPlugin', () => {
  beforeEach(() => {
    mockAdd.mockClear();
  });

  it('increments hit counter when age header is present', async () => {
    const plugin = createResponseCacheMetricsPlugin();
    const listener = (await plugin.requestDidStart!(
      {} as never,
    )) as GraphQLRequestListener<Record<string, unknown>>;

    await listener.willSendResponse!(createMockRequestContext('30') as never);

    expect(mockAdd).toHaveBeenCalledWith(1, {
      operation_name: 'TestQuery',
    });
  });

  it('increments miss counter when cacheable but no age header', async () => {
    const plugin = createResponseCacheMetricsPlugin();
    const listener = (await plugin.requestDidStart!(
      {} as never,
    )) as GraphQLRequestListener<Record<string, unknown>>;

    await listener.willSendResponse!(
      createMockRequestContext(null, 60) as never,
    );

    expect(mockAdd).toHaveBeenCalledWith(1, {
      operation_name: 'TestQuery',
    });
  });

  it('does not increment counters for non-cacheable responses', async () => {
    const plugin = createResponseCacheMetricsPlugin();
    const listener = (await plugin.requestDidStart!(
      {} as never,
    )) as GraphQLRequestListener<Record<string, unknown>>;

    await listener.willSendResponse!(
      createMockRequestContext(null, 0) as never,
    );

    expect(mockAdd).not.toHaveBeenCalled();
  });
});
