import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { Request, Response } from 'express';
import { JwtAuthMiddleware } from './jwt-auth.middleware';

const TEST_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long!!';

function createMockConfigService(
  overrides: { publicOperations?: string[] } = {},
): ConfigService {
  return {
    get: jest.fn().mockReturnValue({
      jwtSecret: TEST_SECRET,
      publicOperations: overrides.publicOperations ?? [],
    }),
  } as unknown as ConfigService;
}

function createMockResponse(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createValidToken(payload: {
  sub: string;
  email: string;
  roles: string[];
  firstName: string;
  lastName: string;
}): string {
  return sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('JwtAuthMiddleware', () => {
  let middleware: JwtAuthMiddleware;

  beforeEach(() => {
    middleware = new JwtAuthMiddleware(createMockConfigService());
  });

  it('maps sub→userId and roles→permissions from user-service JWT and calls next', () => {
    const token = createValidToken({
      sub: 'user-42',
      email: 'user@test.com',
      roles: ['read', 'write'],
      firstName: 'John',
      lastName: 'Doe',
    });
    const req = {
      path: '/graphql',
      headers: { authorization: `Bearer ${token}` },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as unknown as { user: unknown }).user).toEqual({
      userId: 'user-42',
      email: 'user@test.com',
      permissions: ['read', 'write'],
      firstName: 'John',
      lastName: 'Doe',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = {
      path: '/graphql',
      headers: {},
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Missing authorization header',
    });
  });

  it('returns 401 when token format is not Bearer', () => {
    const req = {
      path: '/graphql',
      headers: { authorization: 'Basic some-token' },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Invalid bearer token format',
    });
  });

  it('returns 401 when token is expired', () => {
    const expiredToken = sign(
      {
        sub: 'user-1',
        email: 'u@t.com',
        roles: [],
        firstName: 'A',
        lastName: 'B',
      },
      TEST_SECRET,
      { expiresIn: '-1s' },
    );
    const req = {
      path: '/graphql',
      headers: { authorization: `Bearer ${expiredToken}` },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Invalid or expired token',
    });
  });

  it('skips auth for /health path', () => {
    const req = {
      path: '/health',
      headers: {},
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips auth for /health/ready path', () => {
    const req = {
      path: '/health/ready',
      headers: {},
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  describe('public operations', () => {
    let publicMiddleware: JwtAuthMiddleware;

    beforeEach(() => {
      publicMiddleware = new JwtAuthMiddleware(
        createMockConfigService({
          publicOperations: ['login', 'signup', 'refreshToken'],
        }),
      );
    });

    it('allows public operation without auth', () => {
      const req = {
        path: '/graphql',
        headers: {},
        body: {
          query:
            'mutation { login(input: { email: "a@b.com", password: "p" }) { accessToken } }',
        },
      } as unknown as Request;
      const res = createMockResponse();
      const next = jest.fn();

      publicMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks private operation without auth even when public operations are configured', () => {
      const req = {
        path: '/graphql',
        headers: {},
        body: { query: '{ me { id name } }' },
      } as unknown as Request;
      const res = createMockResponse();
      const next = jest.fn();

      publicMiddleware.use(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('blocks batched request mixing public and private operations', () => {
      const req = {
        path: '/graphql',
        headers: {},
        body: {
          query:
            'mutation { login(input: { email: "a@b.com", password: "p" }) { accessToken } } query { me { id } }',
        },
      } as unknown as Request;
      const res = createMockResponse();
      const next = jest.fn();

      publicMiddleware.use(req, res, next);

      // Invalid GraphQL (multiple anonymous ops) → parse fails → empty fields → requires auth
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('requires auth when body has no query field', () => {
      const req = {
        path: '/graphql',
        headers: {},
        body: { variables: {} },
      } as unknown as Request;
      const res = createMockResponse();
      const next = jest.fn();

      publicMiddleware.use(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
