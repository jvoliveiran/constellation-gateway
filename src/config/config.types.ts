export interface GatewayConfig {
  nodeEnv: string;
  port: number;
  subgraphs: SubgraphConfig[];
  jwtSecret: string;
  logLevel: string;
  allowedOrigins: string[];
  rateLimitTtl: number;
  rateLimitMax: number;
  queryMaxDepth: number;
  queryMaxComplexity: number;
  queryDefaultListSize: number;
  queryComplexityWarnThreshold: number;
  subgraphTimeoutMs: number;
  otelDisabled: boolean;
  otelEndpoint?: string;
  otelHeaders?: string;
}

export interface SubgraphConfig {
  name: string;
  url: string;
}
