import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from './public.decorator';
import { GatewayConfig } from '../config/config.types';
import { UserServiceJwtPayload, GatewayUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = this.getRequest(context);
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = this.extractBearerToken(authHeader);
    const config = this.configService.get<GatewayConfig>('gateway');
    const secret = config?.jwtSecret;

    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    try {
      const decoded = verify(token, secret) as UserServiceJwtPayload;
      request.user = {
        userId: decoded.sub,
        email: decoded.email,
        permissions: decoded.roles,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
      } satisfies GatewayUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private getRequest(context: ExecutionContext) {
    const contextType = context.getType<string>();
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req;
    }
    return context.switchToHttp().getRequest();
  }

  private extractBearerToken(authHeader: string): string {
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) {
      throw new UnauthorizedException('Invalid bearer token format');
    }
    return match[1];
  }
}
