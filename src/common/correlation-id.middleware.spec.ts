import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { Request, Response } from 'express';
import { trace } from '@opentelemetry/api';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate a correlation ID when none provided and no active span', () => {
    const req = { headers: {} } as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).toBeDefined();
    expect(typeof req.headers['x-correlation-id']).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      req.headers['x-correlation-id'],
    );
    expect(next).toHaveBeenCalled();
  });

  it('should preserve existing correlation ID from request', () => {
    const existingId = 'existing-correlation-id';
    const req = {
      headers: { 'x-correlation-id': existingId },
    } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', existingId);
    expect(next).toHaveBeenCalled();
  });

  it('should use OTel traceId when no correlation ID header and active span exists', () => {
    const mockTraceId = 'abcdef1234567890abcdef1234567890';
    const mockSpan = {
      spanContext: () => ({ traceId: mockTraceId }),
    };
    jest.spyOn(trace, 'getSpan').mockReturnValue(mockSpan as any);

    const req = { headers: {} } as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).toBe(mockTraceId);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', mockTraceId);
  });

  it('should fall back to UUID when span has invalid traceId', () => {
    const mockSpan = {
      spanContext: () => ({ traceId: '00000000000000000000000000000000' }),
    };
    jest.spyOn(trace, 'getSpan').mockReturnValue(mockSpan as any);

    const req = { headers: {} } as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    // Should not use the invalid traceId, should generate a UUID instead
    expect(req.headers['x-correlation-id']).not.toBe(
      '00000000000000000000000000000000',
    );
    expect(req.headers['x-correlation-id']).toBeDefined();
  });
});
