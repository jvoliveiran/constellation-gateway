import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GatewayConfig } from '../config/config.types';

const REVOKED_KEY_PREFIX = 'revoked:jwt:';

@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger('TokenBlacklistService');
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<GatewayConfig>('gateway');
    const redisUrl = config?.redisUrl ?? 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      maxRetriesPerRequest: 1,
    });

    this.redis.on('connect', () => {
      this.connected = true;
      this.logger.log('Connected to Redis for token blacklist');
    });

    this.redis.on('error', (err: Error) => {
      this.connected = false;
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    this.redis.connect().catch((err: Error) => {
      this.logger.warn(
        `Failed to connect to Redis for token blacklist: ${err.message}. Revocation checks will be skipped.`,
      );
    });
  }

  /**
   * Checks if a token JTI has been revoked.
   * Returns false (fail-open) if Redis is unavailable.
   */
  async isRevoked(jti: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const result = await this.redis.exists(`${REVOKED_KEY_PREFIX}${jti}`);
      return result === 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Token revocation check failed (Redis error): ${message}. Proceeding with stateless auth.`,
      );
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => {
      // Ignore disconnect errors during shutdown
    });
  }
}
