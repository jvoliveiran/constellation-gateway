import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { trace, context } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';

const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existingId = req.headers[CORRELATION_ID_HEADER] as string;

    // Bridge: prefer incoming header, then active OTel traceId, then random UUID
    const correlationId = existingId || getTraceId() || randomUUID();

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}

function getTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  if (!span) return undefined;

  const traceId = span.spanContext().traceId;
  // OTel uses "00000000000000000000000000000000" for invalid trace IDs
  const isValid = traceId && !/^0+$/.test(traceId);
  return isValid ? traceId : undefined;
}
