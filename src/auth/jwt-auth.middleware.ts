import {
  Injectable,
  NestMiddleware,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { GatewayConfig } from '../config/config.types';
import { extractOperationFields, isPublicOperation } from './public-operations';
import { TokenBlacklistService } from './token-blacklist.service';
import { UserServiceJwtPayload, GatewayUser } from './auth.types';

// Paths that bypass JWT validation. Update this list when adding new public REST endpoints.
const PUBLIC_PATHS = ['/health', '/health/ready'];

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  private readonly jwtSecret: string;
  private readonly publicOperations: string[];
  private readonly logger = new Logger('JwtAuthMiddleware');

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(TokenBlacklistService)
    private readonly tokenBlacklist?: TokenBlacklistService,
  ) {
    const config = this.configService.get<GatewayConfig>('gateway');
    this.jwtSecret = config?.jwtSecret ?? '';
    this.publicOperations = config?.publicOperations ?? [];
  }

  use(req: Request, res: Response, next: NextFunction) {
    const requestPath = req.originalUrl || req.path;
    if (this.isPublicPath(requestPath)) {
      return next();
    }

    if (this.isPublicGraphQLOperation(req)) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      this.logger.warn(
        `JWT auth failed for ${req.path}: missing authorization header`,
        {
          correlationId: req.headers['x-correlation-id'],
        },
      );
      return res
        .status(401)
        .json({ statusCode: 401, message: 'Missing authorization header' });
    }

    const token = this.extractBearerToken(authHeader);
    if (!token) {
      this.logger.warn(
        `JWT auth failed for ${req.path}: invalid bearer token format`,
        {
          correlationId: req.headers['x-correlation-id'],
        },
      );
      return res
        .status(401)
        .json({ statusCode: 401, message: 'Invalid bearer token format' });
    }

    try {
      const decoded = verify(token, this.jwtSecret) as UserServiceJwtPayload;

      // Check token revocation if blacklist service is available and token has jti
      if (this.tokenBlacklist && decoded.jti) {
        this.tokenBlacklist
          .isRevoked(decoded.jti)
          .then((revoked) => {
            if (revoked) {
              this.logger.warn(
                `JWT auth failed for ${req.path}: token has been revoked`,
                {
                  correlationId: req.headers['x-correlation-id'],
                  userId: decoded.sub,
                  jti: decoded.jti,
                },
              );
              return res.status(401).json({
                statusCode: 401,
                message: 'Token has been revoked',
              });
            }
            this.attachUserAndProceed(req, decoded, next);
          })
          .catch(() => {
            // Fail-open: if revocation check fails, proceed with stateless auth
            this.logger.warn(
              `Token revocation check failed, proceeding with stateless auth`,
              {
                correlationId: req.headers['x-correlation-id'],
                userId: decoded.sub,
              },
            );
            this.attachUserAndProceed(req, decoded, next);
          });
        return;
      }

      this.attachUserAndProceed(req, decoded, next);
    } catch {
      this.logger.warn(
        `JWT auth failed for ${req.path}: invalid or expired token`,
        {
          correlationId: req.headers['x-correlation-id'],
        },
      );
      return res
        .status(401)
        .json({ statusCode: 401, message: 'Invalid or expired token' });
    }
  }

  private attachUserAndProceed(
    req: Request,
    decoded: UserServiceJwtPayload,
    next: NextFunction,
  ): void {
    // Map user-service fields (sub, roles) to gateway internal representation (userId, permissions).
    (req as unknown as { user: GatewayUser }).user = {
      userId: decoded.sub,
      permissions: decoded.roles,
    };
    next();
  }

  private isPublicPath(requestPath: string): boolean {
    return PUBLIC_PATHS.some(
      (publicPath) =>
        requestPath === publicPath || requestPath.startsWith(`${publicPath}/`),
    );
  }

  private isPublicGraphQLOperation(req: Request): boolean {
    if (this.publicOperations.length === 0) {
      return false;
    }

    const fields = extractOperationFields(req.body);
    if (fields.length === 0) {
      return false;
    }

    const result = isPublicOperation(fields, this.publicOperations);
    if (result) {
      this.logger.debug(
        `Public operation [${fields.join(', ')}] allowed without auth`,
        { correlationId: req.headers['x-correlation-id'] },
      );
    }
    return result;
  }

  private extractBearerToken(authHeader: string): string | null {
    const match = authHeader.match(/^Bearer (.+)$/i);
    return match ? match[1] : null;
  }
}
