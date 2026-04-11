import Transport from 'winston-transport';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

const SEVERITY_MAP: Record<string, SeverityNumber> = {
  error: SeverityNumber.ERROR,
  warn: SeverityNumber.WARN,
  info: SeverityNumber.INFO,
  http: SeverityNumber.INFO2,
  verbose: SeverityNumber.DEBUG2,
  debug: SeverityNumber.DEBUG,
  silly: SeverityNumber.TRACE,
};

/**
 * Winston transport that forwards log records to the OpenTelemetry Logs SDK.
 * Logs are batched and exported via OTLP alongside traces and metrics.
 */
export class OtelWinstonTransport extends Transport {
  private readonly logger = logs.getLogger('constellation-gateway');

  log(
    info: { level: string; message: string; [key: string]: unknown },
    callback: () => void,
  ) {
    const { level, message, ...attributes } = info;

    this.logger.emit({
      severityNumber: SEVERITY_MAP[level] || SeverityNumber.INFO,
      severityText: level.toUpperCase(),
      body: message,
      attributes: sanitizeAttributes(attributes),
    });

    callback();
  }
}

function sanitizeAttributes(
  attrs: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    // Object.entries skips real Symbols; this catches Winston's stringified
    // internal keys (e.g. "Symbol(level)", "Symbol(splat)")
    if (key.startsWith('Symbol(')) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    } else if (value !== null && value !== undefined) {
      result[key] = String(value);
    }
  }
  return result;
}
