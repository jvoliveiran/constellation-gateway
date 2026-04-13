export type GatewayConfig = {
  nodeEnv: string;
  port: number;
  supergraphPath: string;
  subgraphs: SubgraphConfig[];
  jwtSecret: string;
  publicOperations: string[];
  logLevel: string;
  allowedOrigins: string[];
  rateLimitTtl: number;
  rateLimitMax: number;
  queryMaxDepth: number;
  queryMaxComplexity: number;
  queryDefaultListSize: number;
  queryComplexityWarnThreshold: number;
  subgraphTimeoutMs: number;
  subgraphRetryCount: number;
  subgraphRetryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  apqEnabled: boolean;
  responseCacheEnabled: boolean;
  responseCacheTtl: number;
  responseCacheMaxSize: number;
  tokenRevocationEnabled: boolean;
  redisUrl: string;
  otelDisabled: boolean;
  otelEndpoint?: string;
  otelHeaders?: string;
};

export type SubgraphConfig = {
  name: string;
  url: string;
};
