import { ApolloServerPlugin } from '@apollo/server';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { createHash } from 'crypto';
import { ResponseCachePluginConfig } from './response-cache.types';

type GatewayContext = {
  userId?: string;
  permissions?: string[];
};

/**
 * Builds a cache session ID from the user's identity.
 * All GraphQL queries require authentication, so every cached response is PRIVATE.
 * Returns null for unauthenticated requests (no caching).
 */
export function buildSessionId(context: GatewayContext): string | null {
  if (!context.userId) return null;

  const permHash = createHash('sha256')
    .update(JSON.stringify(context.permissions ?? []))
    .digest('hex')
    .substring(0, 16);

  return `${context.userId}:${permHash}`;
}

export function createResponseCachePlugin(
  _config: ResponseCachePluginConfig,
): ApolloServerPlugin {
  return responseCachePlugin({
    sessionId: async (requestContext) => {
      const context = requestContext.contextValue as GatewayContext;
      return buildSessionId(context);
    },
  });
}
