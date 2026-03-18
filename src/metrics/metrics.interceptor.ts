import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import { Counter, Histogram } from 'prom-client';

const httpRequestsTotal = new Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'status_code', 'operation_name'] as const,
});

const httpRequestDuration = new Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'operation_name'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const graphqlErrorsTotal = new Counter({
  name: 'gateway_graphql_errors_total',
  help: 'Total number of GraphQL errors',
  labelNames: ['operation_name', 'error_type'] as const,
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const contextType = context.getType<string>();
    const startTime = Date.now();

    let method = 'UNKNOWN';
    let operationName = 'unknown';
    let res: { statusCode?: number } | undefined;

    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      const info = gqlContext.getInfo();
      operationName = info?.fieldName || 'unknown';
      method = 'POST';
      res = gqlContext.getContext().req?.res;
    } else {
      const req = context.switchToHttp().getRequest();
      method = req?.method || 'UNKNOWN';
      res = context.switchToHttp().getResponse();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000;
          httpRequestsTotal.inc({
            method,
            status_code: String(res?.statusCode || 200),
            operation_name: operationName,
          });
          httpRequestDuration.observe(
            { method, operation_name: operationName },
            duration,
          );
        },
        error: (error) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = error?.status || '500';
          httpRequestsTotal.inc({
            method,
            status_code: String(statusCode),
            operation_name: operationName,
          });
          httpRequestDuration.observe(
            { method, operation_name: operationName },
            duration,
          );
          graphqlErrorsTotal.inc({
            operation_name: operationName,
            error_type: error?.constructor?.name || 'UnknownError',
          });
        },
      }),
    );
  }
}
