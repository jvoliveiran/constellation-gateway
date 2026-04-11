import { createHash } from 'crypto';
import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { LoggerService } from '@nestjs/common';
import { RequestLogEntry, RequestLogError } from './request-logging.types';

const PLUGIN_CONTEXT = 'RequestLoggingPlugin';

export function hashQuery(query: string): string {
  return createHash('sha256').update(query).digest('hex').slice(0, 16);
}

function isIntrospectionOperation(
  operationName: string | null | undefined,
  query: string | undefined,
): boolean {
  if (operationName === 'IntrospectionQuery') {
    return true;
  }
  if (!query) {
    return false;
  }
  return /\b__schema\b/.test(query) || /\b__type\b/.test(query);
}

function extractErrors(
  body: Record<string, unknown> | undefined,
): RequestLogError[] {
  if (!body || !Array.isArray(body.errors)) {
    return [];
  }

  return body.errors.map(
    (err: { message?: string; extensions?: { code?: string } }) => ({
      message: err.message ?? 'Unknown error',
      code: err.extensions?.code,
    }),
  );
}

type RequestLoggingContext = {
  userId?: string;
  correlationId?: string;
  clientIp?: string;
};

export function createRequestLoggingPlugin(
  logger: LoggerService,
): ApolloServerPlugin<RequestLoggingContext> {
  return {
    async requestDidStart(requestContext) {
      const startTime = Date.now();
      const { userId, correlationId, clientIp } =
        requestContext.contextValue ?? {};
      const querySource = requestContext.request.query;

      const listener: GraphQLRequestListener<RequestLoggingContext> = {
        async willSendResponse(responseContext) {
          const durationMs = Date.now() - startTime;
          const operationName = responseContext.operationName ?? 'anonymous';
          const operationType =
            responseContext.operation?.operation ?? 'unknown';
          const queryHashValue = querySource
            ? hashQuery(querySource)
            : 'unknown';

          const responseBody = responseContext.response.body;
          const singleResult =
            responseBody?.kind === 'single'
              ? responseBody.singleResult
              : undefined;
          const errors = extractErrors(
            singleResult as Record<string, unknown> | undefined,
          );
          const errorCount = errors.length;

          const logEntry: RequestLogEntry = {
            operationName,
            operationType,
            queryHash: queryHashValue,
            durationMs,
            errorCount,
            userId,
            correlationId,
            clientIp,
          };

          if (errorCount > 0) {
            logEntry.errors = errors;
          }

          const isIntrospection = isIntrospectionOperation(
            responseContext.operationName,
            querySource,
          );

          const message =
            errorCount > 0
              ? 'GraphQL request completed with errors'
              : 'GraphQL request completed';

          if (isIntrospection) {
            logger.debug?.(message, {
              context: PLUGIN_CONTEXT,
              ...logEntry,
            });
          } else {
            logger.log(message, {
              context: PLUGIN_CONTEXT,
              ...logEntry,
            });
          }
        },
      };

      return listener;
    },
  };
}
