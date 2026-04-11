import { buildSessionId } from './response-cache.plugin';

describe('buildSessionId', () => {
  it('returns null when userId is missing', () => {
    expect(buildSessionId({})).toBeNull();
    expect(buildSessionId({ permissions: ['read'] })).toBeNull();
  });

  it('returns userId:permissionsHash format for authenticated context', () => {
    const sessionId = buildSessionId({
      userId: 'user-42',
      permissions: ['read'],
    });

    expect(sessionId).toMatch(/^user-42:[a-f0-9]{16}$/);
  });

  it('produces different session IDs for different permissions', () => {
    const idA = buildSessionId({
      userId: 'user-1',
      permissions: ['read'],
    });
    const idB = buildSessionId({
      userId: 'user-1',
      permissions: ['read', 'write'],
    });

    expect(idA).not.toBe(idB);
  });

  it('produces the same session ID for identical user and permissions', () => {
    const idA = buildSessionId({
      userId: 'user-1',
      permissions: ['read', 'write'],
    });
    const idB = buildSessionId({
      userId: 'user-1',
      permissions: ['read', 'write'],
    });

    expect(idA).toBe(idB);
  });

  it('produces different session IDs for different users with same permissions', () => {
    const idA = buildSessionId({
      userId: 'user-1',
      permissions: ['read'],
    });
    const idB = buildSessionId({
      userId: 'user-2',
      permissions: ['read'],
    });

    expect(idA).not.toBe(idB);
  });

  it('handles empty permissions array', () => {
    const sessionId = buildSessionId({
      userId: 'user-1',
      permissions: [],
    });

    expect(sessionId).toMatch(/^user-1:[a-f0-9]{16}$/);
  });
});
