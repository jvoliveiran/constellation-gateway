export type ResilienceConfig = {
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
};
