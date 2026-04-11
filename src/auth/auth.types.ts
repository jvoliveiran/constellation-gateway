// Matches the JWT payload signed by user-service (src/auth/types/jwt-payload.types.ts)
export type UserServiceJwtPayload = {
  sub: string;
  email: string;
  roles: string[];
  jti?: string;
};

// Internal gateway representation attached to req.user
export type GatewayUser = {
  userId: string;
  permissions: string[];
};
