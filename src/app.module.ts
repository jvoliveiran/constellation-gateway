import { IntrospectAndCompose } from '@apollo/gateway';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winston from 'winston';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // TODO: support multiple subgraphs separate by comma
        const [subGraphName, subGraphHost] = configService
          .get('SUBGRAPH')
          .split('|');
        return {
          gateway: {
            supergraphSdl: new IntrospectAndCompose({
              subgraphs: [{ name: subGraphName, url: subGraphHost }],
            }),
          },
        };
      },
      inject: [ConfigService],
    }),
    WinstonModule.forRoot({
      level: 'debug',
      transports: [
        new winston.transports.Console({
          debugStdout: true,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike(
              'Constellation Gateway',
              {
                colors: true,
                prettyPrint: true,
              },
            ),
          ),
        }),
      ],
    }),
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
