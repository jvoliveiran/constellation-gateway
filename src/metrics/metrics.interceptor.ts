import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('constellation-gateway');

const httpRequestsTotal = meter.createCounter('gateway.http.requests', {
  description: 'Total number of HTTP requests',
});

const httpRequestDuration = meter.createHistogram(
  'gateway.http.request.duration',
  {
    description: 'Duration of HTTP requests in seconds',
    unit: 's',
    advice: {
      explicitBucketBoundaries: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    },
  },
);

const graphqlErrorsTotal = meter.createCounter('gateway.graphql.errors', {
  description: 'Total number of GraphQL errors',
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
          httpRequestsTotal.add(1, {
            method,
            status_code: String(res?.statusCode || 200),
            operation_name: operationName,
          });
          httpRequestDuration.record(duration, {
            method,
            operation_name: operationName,
          });
        },
        error: (error) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = error?.status || '500';
          httpRequestsTotal.add(1, {
            method,
            status_code: String(statusCode),
            operation_name: operationName,
          });
          httpRequestDuration.record(duration, {
            method,
            operation_name: operationName,
          });
          graphqlErrorsTotal.add(1, {
            operation_name: operationName,
            error_type: error?.constructor?.name || 'UnknownError',
          });
        },
      }),
    );
  }
}
