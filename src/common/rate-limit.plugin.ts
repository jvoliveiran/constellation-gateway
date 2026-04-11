import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { LoggerService } from '@nestjs/common';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitPluginConfig = {
  ttl: number;
  max: number;
};

const PLUGIN_CONTEXT = 'RateLimitPlugin';

// TODO: Replace with Redis-backed store for horizontal scaling
const store = new Map<string, RateLimitEntry>();

export function createRateLimitPlugin(
  config: RateLimitPluginConfig,
  logger: LoggerService,
): ApolloServerPlugin {
  const { ttl, max } = config;
  const ttlMs = ttl * 1000;

  return {
    async requestDidStart(requestContext) {
      const context = requestContext.contextValue as {
        clientIp?: string;
      };
      const ip = context.clientIp ?? 'unknown';
      const now = Date.now();

      // Lazy cleanup of stale entries
      const existing = store.get(ip);
      if (existing && existing.resetAt < now) {
        store.delete(ip);
      }

      const entry = store.get(ip);

      if (entry) {
        entry.count += 1;
      } else {
        store.set(ip, { count: 1, resetAt: now + ttlMs });
      }

      const currentEntry = store.get(ip);
      const isOverLimit = currentEntry ? currentEntry.count > max : false;

      const listener: GraphQLRequestListener<Record<string, unknown>> = {
        async didResolveOperation() {
          if (isOverLimit) {
            logger.warn(
              `Rate limit exceeded for IP ${ip}, count: ${currentEntry?.count}/${max}`,
              {
                context: PLUGIN_CONTEXT,
                ip,
                count: currentEntry?.count,
                max,
              },
            );

            throw new GraphQLError('Too many requests', {
              extensions: { code: 'RATE_LIMITED' },
            });
          }
        },
      };

      return listener;
    },
  };
}

/**
 * Clears the in-memory rate limit store. Intended for testing only.
 */
export function clearRateLimitStore(): void {
  store.clear();
}
