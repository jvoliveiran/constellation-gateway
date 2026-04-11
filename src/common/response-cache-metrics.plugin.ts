import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('constellation-gateway');

const cacheHitsTotal = meter.createCounter('gateway.response_cache.hits', {
  description: 'Total response cache hits',
});

const cacheMissesTotal = meter.createCounter('gateway.response_cache.misses', {
  description: 'Total response cache misses',
});

export function createResponseCacheMetricsPlugin(): ApolloServerPlugin {
  return {
    async requestDidStart() {
      const listener: GraphQLRequestListener<Record<string, unknown>> = {
        async willSendResponse(requestContext) {
          const ageHeader = requestContext.response.http?.headers?.get('age');
          const operationName = requestContext.operationName ?? 'anonymous';

          if (ageHeader) {
            cacheHitsTotal.add(1, { operation_name: operationName });
          } else {
            const cachePolicy = requestContext.overallCachePolicy;
            if (cachePolicy?.maxAge !== undefined && cachePolicy.maxAge > 0) {
              cacheMissesTotal.add(1, { operation_name: operationName });
            }
          }
        },
      };

      return listener;
    },
  };
}
