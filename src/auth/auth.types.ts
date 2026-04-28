// Matches the JWT payload signed by user-service (src/auth/types/jwt-payload.types.ts)
export type UserServiceJwtPayload = {
  sub: string;
  email: string;
  roles: string[];
  firstName: string;
  lastName: string;
  jti?: string;
};

// Internal gateway representation attached to req.user
export type GatewayUser = {
  userId: string;
  email: string;
  permissions: string[];
  firstName: string;
  lastName: string;
};
