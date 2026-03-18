import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

const TEST_SECRET = 'test-secret-key-that-is-at-least-32-chars';

function createMockExecutionContext(
  headers: Record<string, string> = {},
): ExecutionContext {
  const request = { headers, user: undefined };
  return {
    getType: () => 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    configService = {
      get: jest.fn().mockReturnValue({ jwtSecret: TEST_SECRET }),
    } as unknown as ConfigService;

    guard = new JwtAuthGuard(configService, reflector);
  });

  it('should allow access with a valid token', () => {
    const token = sign(
      { userId: 'user-123', permissions: ['read'] },
      TEST_SECRET,
    );
    const context = createMockExecutionContext({
      authorization: `Bearer ${token}`,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when no authorization header', () => {
    const context = createMockExecutionContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for expired token', () => {
    const token = sign({ userId: 'user-123', permissions: [] }, TEST_SECRET, {
      expiresIn: -1,
    });
    const context = createMockExecutionContext({
      authorization: `Bearer ${token}`,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for malformed token', () => {
    const context = createMockExecutionContext({
      authorization: 'Bearer not-a-valid-jwt',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for invalid bearer format', () => {
    const context = createMockExecutionContext({
      authorization: 'InvalidFormat token',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should skip auth for public routes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const context = createMockExecutionContext({});

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should attach user data to request on valid token', () => {
    const payload = { userId: 'user-456', permissions: ['admin'] };
    const token = sign(payload, TEST_SECRET);
    const context = createMockExecutionContext({
      authorization: `Bearer ${token}`,
    });

    guard.canActivate(context);

    const request = context.switchToHttp().getRequest();
    expect(request.user).toEqual({
      userId: 'user-456',
      permissions: ['admin'],
    });
  });
});
