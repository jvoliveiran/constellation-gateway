import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { getComplexity, simpleEstimator } from 'graphql-query-complexity';
import { LoggerService } from '@nestjs/common';
import { QueryComplexityPluginConfig } from './query-complexity.types';

const PLUGIN_CONTEXT = 'QueryComplexityPlugin';

export function isIntrospectionQuery(
  operationName: string | undefined,
  source: string,
): boolean {
  if (operationName === 'IntrospectionQuery') {
    return true;
  }
  return /\b__schema\b/.test(source) || /\b__type\b/.test(source);
}

export function createQueryComplexityPlugin(
  config: QueryComplexityPluginConfig,
  logger: LoggerService,
): ApolloServerPlugin {
  const { maxComplexity, defaultListSize, warnThreshold } = config;
  const warnLimit = maxComplexity * warnThreshold;

  return {
    async requestDidStart(requestContext) {
      const { schema } = requestContext;

      const listener: GraphQLRequestListener<Record<string, unknown>> = {
        async didResolveOperation(resolveContext) {
          const { document, operationName } = resolveContext;

          const source = resolveContext.request.query ?? '';
          if (isIntrospectionQuery(operationName ?? undefined, source)) {
            return;
          }

          // simpleEstimator assigns defaultComplexity per field and sums recursively.
          // defaultListSize is used as the per-field cost to approximate list-heavy queries,
          // since the gateway cannot distinguish list vs scalar fields in the composed schema.
          let complexity: number;
          try {
            complexity = getComplexity({
              schema,
              query: document,
              variables: resolveContext.request.variables ?? {},
              estimators: [
                simpleEstimator({ defaultComplexity: defaultListSize }),
              ],
            });
          } catch (error: unknown) {
            logger.error('Failed to calculate query complexity', {
              context: PLUGIN_CONTEXT,
              error: error instanceof Error ? error.message : String(error),
              operationName: operationName ?? 'anonymous',
            });
            return;
          }

          if (complexity > maxComplexity) {
            // Note: complexity and maxComplexity extensions are exposed in development only.
            // In production, formatError in app.module.ts strips all extensions except `code`.
            throw new GraphQLError(
              `Query complexity of ${complexity} exceeds the maximum allowed complexity of ${maxComplexity}.`,
              {
                extensions: {
                  code: 'QUERY_TOO_COMPLEX',
                  complexity,
                  maxComplexity,
                },
              },
            );
          }

          if (complexity >= warnLimit) {
            logger.warn(
              `Query approaching complexity limit: ${complexity}/${maxComplexity}`,
              {
                context: PLUGIN_CONTEXT,
                complexity,
                maxComplexity,
                operationName: operationName ?? 'anonymous',
              },
            );
          }
        },
      };

      return listener;
    },
  };
}
