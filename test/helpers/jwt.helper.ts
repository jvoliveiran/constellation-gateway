import { sign } from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long!!';

// Accepts the gateway-facing shape (userId, permissions) for E2E convenience,
// but signs with the user-service payload shape (sub, roles) to match real tokens.
type TestJwtInput = {
  userId: string;
  permissions: string[];
};

export function createTestJwt(input: TestJwtInput): string {
  return sign(
    {
      sub: input.userId,
      email: `${input.userId}@test.com`,
      roles: input.permissions,
    },
    TEST_SECRET,
    { expiresIn: '1h' },
  );
}

export function createExpiredJwt(): string {
  return sign(
    { sub: 'expired-user', email: 'expired@test.com', roles: [] },
    TEST_SECRET,
    { expiresIn: '-1s' },
  );
}
