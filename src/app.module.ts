import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winston from 'winston';
// TODO: install jsonwebtoken
//import { verify, decode } from 'jsonwebtoken';
import { HealthModule } from './health/health.module';

// https://github.com/tkssharma/nestjs-with-apollo-federation-gateway/blob/main/packages/getway-service/src/app.module.ts
// const getToken = (authToken: string): string => {
//   console.log(authToken);
//   const match = authToken.match(/^Bearer (.*)$/);
//   if (!match || match.length < 2) {
//     throw new HttpException(
//       { message: INVALID_BEARER_TOKEN },
//       HttpStatus.UNAUTHORIZED,
//     );
//   }
//   console.log(match[1]);
//   return match[1];
// };

// const decodeToken = (tokenString: string) => {
//   // TODO: Add secret key
//   const decoded = decode(tokenString, process.env.SECRET_KEY);
//   if (!decoded) {
//     throw new HttpException(
//       { message: INVALID_AUTH_TOKEN },
//       HttpStatus.UNAUTHORIZED,
//     );
//   }
//   return decoded;
// };

// const handleAuth = ({ req }) => {
//   try {
//     if (req.headers.authorization) {
//       const token = getToken(req.headers.authorization);
//       const verified = verify(token, process.env.SECRET_KEY);
//       if (!verified) {
//         throw new HttpException(
//           { message: INVALID_AUTH_TOKEN },
//           HttpStatus.UNAUTHORIZED,
//         );
//       }
//       const decoded: any = decodeToken(token);
//       return {
//         userId: decoded.userId,
//         permissions: decoded.permissions,
//         authorization: `${req.headers.authorization}`,
//       };
//     }
//   } catch (err) {
//     throw new UnauthorizedException(
//       'User unauthorized with invalid authorization Headers',
//     );
//   }
// };

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
          server: {
            // TODO: uncoment
            // context: handleAuth,
            playground: false,
            plugins: [ApolloServerPluginLandingPageLocalDefault()],
          },
          gateway: {
            buildService: ({ url }) => {
              return new RemoteGraphQLDataSource({
                url,
                willSendRequest({ request, context }: any) {
                  request.http.headers.set('userId', context.userId);
                  // for now pass authorization also
                  request.http.headers.set(
                    'authorization',
                    context.authorization,
                  );
                  request.http.headers.set('permissions', context.permissions);
                },
              });
            },
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
