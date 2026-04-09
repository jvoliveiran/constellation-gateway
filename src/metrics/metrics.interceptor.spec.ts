import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';

const mockAdd = jest.fn();
const mockRecord = jest.fn();

jest.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createCounter: () => ({ add: mockAdd }),
      createHistogram: () => ({ record: mockRecord }),
    }),
  },
}));

jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

import { MetricsInterceptor } from './metrics.interceptor';
import { GqlExecutionContext } from '@nestjs/graphql';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new MetricsInterceptor();
  });

  function createMockContext(type: string = 'http'): ExecutionContext {
    if (type === 'graphql') {
      return {
        getType: () => 'graphql',
        switchToHttp: () => ({
          getRequest: () => ({ method: 'POST' }),
        }),
      } as unknown as ExecutionContext;
    }
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
  }

  function createMockHandler(response: unknown = {}): CallHandler {
    return { handle: () => of(response) };
  }

  function createErrorHandler(error: Error): CallHandler {
    return { handle: () => throwError(() => error) };
  }

  it('records request count and duration on successful HTTP request', (done) => {
    const context = createMockContext('http');
    const handler = createMockHandler({ data: 'test' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(mockAdd).toHaveBeenCalledWith(1, {
          method: 'GET',
          status_code: '200',
          operation_name: 'unknown',
        });
        expect(mockRecord).toHaveBeenCalledWith(expect.any(Number), {
          method: 'GET',
          operation_name: 'unknown',
        });
        done();
      },
    });
  });

  it('records request count, duration, and error counter on error', (done) => {
    const context = createMockContext('http');
    const error = Object.assign(new Error('Test error'), { status: 500 });
    const handler = createErrorHandler(error);

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        // httpRequestsTotal.add
        expect(mockAdd).toHaveBeenCalledWith(1, {
          method: 'GET',
          status_code: '500',
          operation_name: 'unknown',
        });
        // graphqlErrorsTotal.add
        expect(mockAdd).toHaveBeenCalledWith(1, {
          operation_name: 'unknown',
          error_type: 'Error',
        });
        // httpRequestDuration.record
        expect(mockRecord).toHaveBeenCalledWith(expect.any(Number), {
          method: 'GET',
          operation_name: 'unknown',
        });
        done();
      },
    });
  });

  it('extracts GraphQL operation name from gql context', (done) => {
    (GqlExecutionContext.create as jest.Mock).mockReturnValue({
      getInfo: () => ({ fieldName: 'getUsers' }),
      getContext: () => ({ req: { res: { statusCode: 200 } } }),
    });

    const gqlContext = createMockContext('graphql');
    const handler = createMockHandler({ data: 'users' });

    interceptor.intercept(gqlContext, handler).subscribe({
      next: () => {
        expect(mockAdd).toHaveBeenCalledWith(1, {
          method: 'POST',
          status_code: '200',
          operation_name: 'getUsers',
        });
        done();
      },
    });
  });
});
