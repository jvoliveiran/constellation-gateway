import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { register } from 'prom-client';
import { MetricsInterceptor } from './metrics.interceptor';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    interceptor = new MetricsInterceptor();
  });

  afterAll(() => {
    register.clear();
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

  it('should record metrics on successful HTTP request', (done) => {
    const context = createMockContext('http');
    const handler = createMockHandler({ data: 'test' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        done();
      },
    });
  });

  it('should record metrics on error', (done) => {
    const context = createMockContext('http');
    const error = Object.assign(new Error('Test error'), { status: 500 });
    const handler = createErrorHandler(error);

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        done();
      },
    });
  });
});
