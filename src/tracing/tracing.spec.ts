import { shutdownTracing } from './tracing';

describe('Tracing', () => {
  it('should export shutdownTracing function', () => {
    expect(typeof shutdownTracing).toBe('function');
  });

  it('should shutdown cleanly when SDK is disabled', async () => {
    await expect(shutdownTracing()).resolves.toBeUndefined();
  });
});
