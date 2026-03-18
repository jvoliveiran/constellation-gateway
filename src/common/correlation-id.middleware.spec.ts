import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { Request, Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should generate a correlation ID when none provided', () => {
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
});
