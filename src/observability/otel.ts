import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// Reads process.env directly because this file runs as a top-level import
// (before NestJS boots), so ConfigService and Zod validation are not yet available.
const isDisabled = process.env.OTEL_SDK_DISABLED === 'true';

let sdk: NodeSDK | undefined;

if (!isDisabled) {
  const headers = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const traceExporter = new OTLPTraceExporter({
    url: endpoint ? `${endpoint}/v1/traces` : undefined,
    headers,
  });

  const metricExporter = new OTLPMetricExporter({
    url: endpoint ? `${endpoint}/v1/metrics` : undefined,
    headers,
  });

  const logExporter = new OTLPLogExporter({
    url: endpoint ? `${endpoint}/v1/logs` : undefined,
    headers,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'constellation-gateway',
    }),
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60_000,
    }),
    logRecordProcessor: new BatchLogRecordProcessor(logExporter),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable instrumentations for packages not used by this gateway
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

export function parseOtlpHeaders(
  raw?: string,
): Record<string, string> | undefined {
  if (!raw) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      headers[pair.slice(0, eqIndex).trim()] = pair.slice(eqIndex + 1).trim();
    }
  }
  return headers;
}

export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}
