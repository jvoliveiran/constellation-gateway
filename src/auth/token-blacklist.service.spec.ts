import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';

// Mock ioredis before importing the service
const mockExists = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    exists: mockExists,
    connect: mockConnect,
    quit: mockQuit,
    on: mockOn,
  }));
});

function createMockConfigService(): ConfigService {
  return {
    get: jest.fn().mockReturnValue({
      redisUrl: 'redis://localhost:6379',
    }),
  } as unknown as ConfigService;
}

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokenBlacklistService(createMockConfigService());

    // Simulate successful connection by firing the connect callback
    const connectCallback = mockOn.mock.calls.find(
      (call: [string, () => void]) => call[0] === 'connect',
    );
    if (connectCallback) {
      connectCallback[1]();
    }
  });

  it('returns true when token JTI exists in Redis', async () => {
    mockExists.mockResolvedValue(1);

    const result = await service.isRevoked('revoked-jti-123');

    expect(result).toBe(true);
    expect(mockExists).toHaveBeenCalledWith('revoked:jwt:revoked-jti-123');
  });

  it('returns false when token JTI does not exist in Redis', async () => {
    mockExists.mockResolvedValue(0);

    const result = await service.isRevoked('valid-jti-456');

    expect(result).toBe(false);
    expect(mockExists).toHaveBeenCalledWith('revoked:jwt:valid-jti-456');
  });

  it('returns false (fail-open) when Redis throws an error', async () => {
    mockExists.mockRejectedValue(new Error('Connection refused'));

    const result = await service.isRevoked('any-jti');

    expect(result).toBe(false);
  });

  it('returns false when Redis is not connected', async () => {
    // Simulate disconnection by firing the error callback
    const errorCallback = mockOn.mock.calls.find(
      (call: [string, (err: Error) => void]) => call[0] === 'error',
    );
    if (errorCallback) {
      errorCallback[1](new Error('disconnected'));
    }

    const result = await service.isRevoked('any-jti');

    expect(result).toBe(false);
    expect(mockExists).not.toHaveBeenCalled();
  });
});
