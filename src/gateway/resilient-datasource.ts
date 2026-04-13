import {
  RemoteGraphQLDataSource,
  GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';
import { GatewayGraphQLResponse } from '@apollo/server-gateway-interface';
import CircuitBreaker from 'opossum';
import { LoggerService } from '@nestjs/common';
import { ResilienceConfig } from './resilient-datasource.types';

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'ABORT_ERR',
  'ERR_NETWORK',
]);

const RETRYABLE_HTTP_STATUS_CODES = new Set([502, 503, 504]);

export class ResilientGraphQLDataSource extends RemoteGraphQLDataSource {
  private readonly breaker: CircuitBreaker<
    [GraphQLDataSourceProcessOptions],
    GatewayGraphQLResponse
  >;
  private readonly resilience: ResilienceConfig;
  private readonly log: LoggerService;

  constructor(config: {
    url: string;
    resilience: ResilienceConfig;
    logger: LoggerService;
  }) {
    super({ url: config.url });
    this.resilience = config.resilience;
    this.log = config.logger;

    const boundExecute = this.executeWithRetry.bind(this);

    this.breaker = new CircuitBreaker(boundExecute, {
      timeout: false,
      volumeThreshold: this.resilience.circuitBreakerThreshold,
      resetTimeout: this.resilience.circuitBreakerResetMs,
      rollingCountTimeout: this.resilience.circuitBreakerResetMs,
      rollingCountBuckets: 5,
      errorThresholdPercentage: 100,
    });

    this.breaker.on('open', () => {
      this.log.warn(
        `Circuit breaker OPENED for subgraph ${this.url}: failures exceeded threshold of ${this.resilience.circuitBreakerThreshold}`,
        { context: 'ResilientGraphQLDataSource', subgraphUrl: this.url },
      );
    });

    this.breaker.on('halfOpen', () => {
      this.log.warn(
        `Circuit breaker HALF-OPEN for subgraph ${this.url}: allowing probe request`,
        { context: 'ResilientGraphQLDataSource', subgraphUrl: this.url },
      );
    });

    this.breaker.on('close', () => {
      this.log.warn(
        `Circuit breaker CLOSED for subgraph ${this.url}: probe request succeeded`,
        { context: 'ResilientGraphQLDataSource', subgraphUrl: this.url },
      );
    });
  }

  override async process(
    options: GraphQLDataSourceProcessOptions,
  ): Promise<GatewayGraphQLResponse> {
    return this.breaker.fire(options);
  }

  private async executeWithRetry(
    options: GraphQLDataSourceProcessOptions,
  ): Promise<GatewayGraphQLResponse> {
    const maxAttempts = this.resilience.retryCount + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.executeWithTimeout(options);
        return response;
      } catch (err: unknown) {
        lastError = err;

        if (!isRetryableError(err) || attempt === maxAttempts) {
          break;
        }

        const delay = this.resilience.retryDelayMs * Math.pow(2, attempt - 1);
        this.log.debug?.(
          `Retrying subgraph request to ${this.url}: attempt ${attempt + 1}/${maxAttempts}, delay ${delay}ms, reason: ${errorMessage(err)}`,
          { context: 'ResilientGraphQLDataSource', subgraphUrl: this.url },
        );

        await sleep(delay);
      }
    }

    this.log.warn(
      `Subgraph request to ${this.url} failed after ${maxAttempts} attempts: ${errorMessage(lastError)}`,
      { context: 'ResilientGraphQLDataSource', subgraphUrl: this.url },
    );

    throw lastError;
  }

  private async executeWithTimeout(
    options: GraphQLDataSourceProcessOptions,
  ): Promise<GatewayGraphQLResponse> {
    return Promise.race([
      super.process(options),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          const timeoutError = new Error(
            `Subgraph request to ${this.url} timed out after ${this.resilience.timeoutMs}ms`,
          );
          (timeoutError as NodeJS.ErrnoException).code = 'ABORT_ERR';
          reject(timeoutError);
        }, this.resilience.timeoutMs);
      }),
    ]);
  }
}

export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  const code = (err as NodeJS.ErrnoException).code;
  if (code && RETRYABLE_NETWORK_CODES.has(code)) {
    return true;
  }

  const status = (err as { status?: number }).status;
  if (status && RETRYABLE_HTTP_STATUS_CODES.has(status)) {
    return true;
  }

  const extensions = (err as { extensions?: { code?: string } }).extensions;
  if (
    extensions?.code === 'ECONNREFUSED' ||
    extensions?.code === 'ECONNRESET'
  ) {
    return true;
  }

  return false;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
