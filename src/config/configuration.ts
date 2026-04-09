import { registerAs } from '@nestjs/config';
import { GatewayConfig, SubgraphConfig } from './config.types';

function parseSubgraphs(raw: string): SubgraphConfig[] {
  return raw.split(',').map((entry) => {
    const [name, url] = entry.trim().split('|');
    return { name, url };
  });
}

export default registerAs(
  'gateway',
  (): GatewayConfig => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.SERVICE_PORT || '3000', 10),
    subgraphs: parseSubgraphs(process.env.SUBGRAPH || ''),
    jwtSecret: process.env.JWT_SECRET || '',
    logLevel: process.env.LOG_LEVEL || 'info',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3002')
      .split(',')
      .map((o) => o.trim()),
    rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    queryMaxDepth: parseInt(process.env.QUERY_MAX_DEPTH || '10', 10),
    queryMaxComplexity: parseInt(
      process.env.QUERY_MAX_COMPLEXITY || '1000',
      10,
    ),
    queryDefaultListSize: parseInt(
      process.env.QUERY_DEFAULT_LIST_SIZE || '50',
      10,
    ),
    queryComplexityWarnThreshold: parseFloat(
      process.env.QUERY_COMPLEXITY_WARN_THRESHOLD || '0.8',
    ),
    subgraphTimeoutMs: parseInt(process.env.SUBGRAPH_TIMEOUT_MS || '30000', 10),
    otelDisabled: process.env.OTEL_SDK_DISABLED !== 'false',
    otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS,
  }),
);
