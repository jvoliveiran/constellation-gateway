import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenBlacklistService } from './token-blacklist.service';
import { GatewayConfig } from '../config/config.types';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: TokenBlacklistService,
      useFactory: (configService: ConfigService) => {
        const config = configService.get<GatewayConfig>('gateway');
        if (!config?.tokenRevocationEnabled) {
          return undefined;
        }
        return new TokenBlacklistService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [TokenBlacklistService],
})
export class AuthModule {}
