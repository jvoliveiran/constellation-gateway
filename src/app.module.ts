import { RemoteGraphQLDataSource } from '@apollo/gateway';
import { loadSupergraphSdl } from './supergraph/supergraph.loader';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import depthLimit from 'graphql-depth-limit';
import { createQueryComplexityPlugin } from './common/query-complexity.plugin';
import { GraphQLFormattedError } from 'graphql';
import { context as otelContext, propagation } from '@opentelemetry/api';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winston from 'winston';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { GqlThrottlerGuard } from './common/gql-throttler.guard';
import { validate } from './config/config.validation';
import gatewayConfig from './config/configuration';
import { GatewayConfig } from './config/config.types';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { MetricsModule } from './metrics/metrics.module';
import { OtelWinstonTransport } from './observability/otel-winston-transport';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [gatewayConfig],
      validate,
    }),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Config is guaranteed by Zod validation at startup
        const config = configService.get<GatewayConfig>(
          'gateway',
        ) as GatewayConfig;
        const {
          supergraphPath,
          queryMaxDepth: maxDepth,
          queryMaxComplexity: maxComplexity,
          queryDefaultListSize: defaultListSize,
          queryComplexityWarnThreshold: warnThreshold,
          nodeEnv,
        } = config;
        const isProduction = nodeEnv === 'production';

        const logger = new Logger('SupergraphLoader');
        logger.log(`Loading supergraph SDL from "${supergraphPath}"`);

        const complexityPlugin = createQueryComplexityPlugin(
          { maxComplexity, defaultListSize, warnThreshold },
          new Logger('QueryComplexityPlugin'),
        );

        const plugins = isProduction
          ? [ApolloServerPluginLandingPageDisabled(), complexityPlugin]
          : [ApolloServerPluginLandingPageLocalDefault(), complexityPlugin];

        return {
          server: {
            context: ({
              req,
            }: {
              req: {
                user?: { userId: string; permissions: string[] };
                headers: Record<string, string>;
              };
            }) => ({
              userId: req.user?.userId,
              permissions: req.user?.permissions,
              authorization: req.headers?.authorization,
              correlationId: req.headers?.['x-correlation-id'],
            }),
            playground: false,
            plugins,
            validationRules: [depthLimit(maxDepth)],
            formatError: (
              formattedError: GraphQLFormattedError,
            ): GraphQLFormattedError => {
              if (isProduction) {
                return {
                  message: formattedError.message,
                  locations: formattedError.locations,
                  path: formattedError.path,
                  extensions: formattedError.extensions?.code
                    ? { code: formattedError.extensions.code }
                    : undefined,
                };
              }
              return formattedError;
            },
          },
          gateway: {
            buildService: ({ url }) => {
              return new RemoteGraphQLDataSource({
                url,
                willSendRequest({ request, context }) {
                  // Propagate W3C trace context (traceparent + tracestate) to subgraphs
                  propagation.inject(
                    otelContext.active(),
                    request.http?.headers,
                    {
                      set: (carrier, key, value) => carrier?.set(key, value),
                    },
                  );

                  if (context.userId) {
                    request.http?.headers.set('userId', context.userId);
                  }
                  if (context.authorization) {
                    request.http?.headers.set(
                      'authorization',
                      context.authorization,
                    );
                  }
                  if (context.permissions) {
                    request.http?.headers.set(
                      'permissions',
                      JSON.stringify(context.permissions),
                    );
                  }
                  if (context.correlationId) {
                    request.http?.headers.set(
                      'x-correlation-id',
                      context.correlationId,
                    );
                  }
                },
              });
            },
            supergraphSdl: loadSupergraphSdl(supergraphPath),
          },
        };
      },
      inject: [ConfigService],
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const { nodeEnv, logLevel } = configService.get<GatewayConfig>(
          'gateway',
        ) as GatewayConfig;
        const isProduction = nodeEnv === 'production';

        const productionFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        );

        const developmentFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike('Constellation Gateway', {
            colors: true,
            prettyPrint: true,
          }),
        );

        return {
          level: logLevel,
          defaultMeta: { service: 'constellation-gateway' },
          transports: [
            new winston.transports.Console({
              debugStdout: true,
              format: isProduction ? productionFormat : developmentFormat,
            }),
            new OtelWinstonTransport({
              level: logLevel,
            }),
          ],
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const { rateLimitTtl, rateLimitMax } = configService.get<GatewayConfig>(
          'gateway',
        ) as GatewayConfig;
        return [
          {
            ttl: rateLimitTtl * 1000,
            limit: rateLimitMax,
          },
        ];
      },
      inject: [ConfigService],
    }),
    HealthModule,
    AuthModule,
    MetricsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
