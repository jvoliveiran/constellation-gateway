# Architectural Decision Records

This document captures key architectural decisions made during the development of the constellation-gateway, including the context, options considered, and rationale behind each choice. It serves as a reference for future research and onboarding.

---

## ADR-001: Response Cache — `age` Header Behavior

**Date**: 2026-04-10
**Status**: Accepted

**Context**: When the response cache serves a cached response, Apollo Server automatically adds an `age` HTTP header indicating how many seconds the response has been in cache. The question was whether to strip this header before it reaches clients.

**Options considered**:
1. **Leave it** — Provides free observability; clients and monitoring tools can inspect cache behavior. Standard HTTP semantics (RFC 7234).
2. **Strip it** — Prevents interaction with CDN/reverse proxy HTTP caching layers that may interpret `age` and apply their own caching on top.

**Decision**: Leave the `age` header in responses.

**Rationale**: The current architecture has no CDN or caching reverse proxy in front of the gateway. The header provides valuable observability for debugging stale data issues. If a caching proxy is added in the future, the header can be stripped via a simple Express middleware (`res.removeHeader('age')`).

---

## ADR-002: Response Cache — Introspection Query Caching

**Date**: 2026-04-10
**Status**: Accepted

**Context**: Introspection queries (`{ __schema { ... } }`) are expensive (50-200KB responses) and sent frequently by developer tools (Apollo Sandbox, GraphQL Playground). The gateway uses static supergraph composition, so the schema is immutable for the process lifetime. The question was whether to cache these queries.

**Options considered**:
1. **Cache them** — Saves processing for repeated introspection from developer tools. Schema is immutable until gateway restart.
2. **Exclude them** — Avoids per-user cache duplication since the `sessionId` includes `userId:permHash`, meaning each developer gets their own identical cached copy.

**Decision**: Cache introspection queries.

**Rationale**: Introspection is disabled in production (`ApolloServerPluginLandingPageDisabled`), so the benefit is limited to development/staging environments where repeated Sandbox loads are common. The per-user duplication is negligible given the bounded LRU cache size (default 500 entries). If permission-scoped schemas are ever introduced, the existing `sessionId` keying already handles isolation correctly.

---

## ADR-003: Response Cache — Max Size Semantics (Entry Count vs Byte Size)

**Date**: 2026-04-10
**Status**: Accepted

**Context**: The `RESPONSE_CACHE_MAX_SIZE` env var controls the upper bound of the in-memory LRU cache. Apollo's built-in `InMemoryLRUCache` is bounded by entry count, not bytes. The question was whether to use entry count or implement byte-level control.

**Options considered**:
1. **Entry count** — Simple, predictable, matches Apollo's native behavior. Default 500 entries ≈ 2.5MB with average 5KB responses.
2. **Byte size** — More precise memory control for varying response sizes. Requires a custom `KeyValueCache` implementation wrapping `lru-cache` with `maxSize` in bytes.
3. **Hybrid** — Start with entry count, monitor via OTel metrics and health heap check, migrate to byte-based if memory becomes a concern.

**Decision**: Entry count, with monitoring in place.

**Rationale**: Entry count is the pragmatic choice for the initial implementation. The default of 500 entries with LRU eviction keeps memory bounded. The existing health check monitors heap usage (256MB threshold). OpenTelemetry metrics track cache hit/miss rates. If monitoring reveals large response size variance causing memory pressure, byte-based control can be added later using `lru-cache` without changing the public env var API.

---

## ADR-004: JWT Auth — Middleware vs NestJS Guard for Apollo Gateway

**Date**: 2026-04-10
**Status**: Accepted

**Context**: NestJS `APP_GUARD` providers (`JwtAuthGuard`, `GqlThrottlerGuard`) don't intercept Apollo Gateway proxy requests. The `ApolloGatewayDriver` registers `/graphql` as Express middleware, which processes requests before the NestJS guard pipeline fires.

**Options considered**:
1. **Express middleware** — NestJS middleware applied via `AppModule.configure()`. Runs at Express level before Apollo, has DI access.
2. **Apollo Server plugin** — Auth in `requestDidStart` or `didResolveOperation` hook. Runs inside Apollo lifecycle.
3. **Keep guards only** — Accept that guards don't fire for Gateway requests.

**Decision**: NestJS middleware (`JwtAuthMiddleware`) for auth, Apollo plugin for rate limiting.

**Rationale**: Middleware follows the existing project pattern (`CorrelationIdMiddleware`). It runs before Apollo processes the request, allowing early 401 rejection. It has access to NestJS DI (ConfigService). The existing `JwtAuthGuard` remains as `APP_GUARD` for defense-in-depth on any future NestJS controller routes. Rate limiting uses an Apollo plugin (`didResolveOperation`) for proper GraphQL error propagation.

---

## ADR-005: JWT Auth Middleware — Path-Based Exclusion for Public Endpoints

**Date**: 2026-04-10
**Status**: Accepted

**Context**: The `JwtAuthMiddleware` runs on all routes. Health endpoints (`/health`, `/health/ready`) must be accessible without authentication. NestJS middleware cannot read decorator metadata (`@Public()`), so the guard's `Reflector`-based approach doesn't work.

**Options considered**:
1. **Hardcoded constant** — `PUBLIC_PATHS = ['/health', '/health/ready']` in the middleware file. Simple, explicit.
2. **Environment variable** — `AUTH_EXCLUDED_PATHS=/health,/health/ready`. More flexible but adds config complexity.
3. **Route table scan at startup** — Programmatically find routes with `@Public()` decorator. Complex, fragile.

**Decision**: Hardcoded constant.

**Rationale**: The gateway has only two public REST endpoints and they are unlikely to change frequently. The constant is co-located with the middleware for discoverability. A comment documents that adding new public endpoints requires updating the list. If the number of public endpoints grows, the approach can be migrated to an env var without breaking changes.

---

## ADR-006: Rate Limiting — In-Memory Store vs Redis

**Date**: 2026-04-10
**Status**: Accepted (with future migration path)

**Context**: The rate limit plugin needs a store to track request counts per IP within a TTL window. The gateway currently runs as a single instance.

**Options considered**:
1. **In-memory `Map`** — Simple, no external dependencies. Does not work across multiple gateway instances.
2. **Redis-backed store** — Shared state across instances. Adds operational dependency.

**Decision**: In-memory `Map` with a TODO for Redis migration.

**Rationale**: The gateway runs as a single instance. Adding Redis as a dependency for rate limiting alone is premature. The in-memory store is bounded by lazy TTL cleanup. When horizontal scaling is needed, both the rate limiter and the response cache should migrate to Redis simultaneously. A `// TODO` comment documents this migration path.

---

## ADR-007: TypeScript Config — `esModuleInterop` Migration

**Date**: 2026-04-10
**Status**: Accepted

**Context**: The project's `tsconfig.json` used `allowSyntheticDefaultImports: true` without `esModuleInterop`. This caused issues with `ts-jest` in E2E tests: default imports (`import X from 'mod'`) compiled differently at runtime, breaking modules like `graphql-depth-limit` and `express`.

**Options considered**:
1. **Add `esModuleInterop: true`** — Standardizes import behavior across `tsc` and `ts-jest`. Requires changing `import * as Transport from 'winston-transport'` to `import Transport from 'winston-transport'`.
2. **Add `esModuleInterop` only in E2E tsconfig** — Avoids source changes but creates inconsistency between build and test compilation.
3. **Use `diagnostics: false` in ts-jest** — Skips type checking but doesn't fix runtime import issues.

**Decision**: Add `esModuleInterop: true` to the main `tsconfig.json`.

**Rationale**: `esModuleInterop` is the NestJS recommended setting and is the modern TypeScript default. The only source change required was in `otel-winston-transport.ts` (`import * as Transport` → `import Transport`). All 85 unit tests and 20+ E2E tests pass after the change. Build output is functionally identical.

---

## ADR-008: JWT Payload Mapping — Gateway Adapts to User-Service Token Format

**Date**: 2026-04-10
**Status**: Accepted

**Context**: The user-service signs JWTs with the standard payload `{ sub, email, roles }`, but the gateway internally uses `{ userId, permissions }` for forwarding headers to subgraphs. The question was whether to change the user-service payload format or adapt at the gateway.

**Options considered**:
1. **Adapt at the gateway** — Map `sub`→`userId` and `roles`→`permissions` in the middleware/guard. User-service remains unchanged.
2. **Change user-service** — Sign tokens with `{ userId, permissions }` to match the gateway. Requires coordinating changes across services and potentially breaking existing consumers.
3. **Use a shared type package** — Publish a common JWT payload type. Adds build-time coupling between services.

**Decision**: Adapt at the gateway.

**Rationale**: The user-service follows JWT standards (`sub` is the standard subject claim). The gateway is the consumer and should adapt to the producer's format. This avoids coupling between services and keeps the user-service aligned with JWT conventions. The mapping is explicit and documented in `auth.types.ts`. If additional subgraphs issue JWTs with different payload shapes, the gateway can add format-specific mappers without affecting existing services.

---

## ADR-009: Public Operation Routing — Config-Based Allowlist vs Supergraph Directive Detection

**Date**: 2026-04-10
**Status**: Accepted

**Context**: The `JwtAuthMiddleware` blocks all `/graphql` requests without a token. Public mutations (login, signup, etc.) need to pass through. The question was how to determine which operations are public.

**Options considered**:
1. **`PUBLIC_OPERATIONS` env var** — Comma-separated list of GraphQL field names. Simple, explicit, no schema parsing at startup.
2. **`@tag(name: "public")` in supergraph SDL** — Parse the composed supergraph at startup, extract tagged operations. Auto-discovers public operations from schema metadata.
3. **Hardcoded list in gateway code** — No configuration, lowest flexibility.
4. **User-service `@public`/`@private` directives via `@composeDirective`** — Propagate subgraph custom directives into the supergraph. Requires federation tooling changes.

**Decision**: `PUBLIC_OPERATIONS` env var with future path to `@tag` detection.

**Rationale**: The env var approach requires no changes to the user-service or federation tooling. It is explicit — operators see exactly which operations are public in the deployment config. The middleware parses the GraphQL request body using the `graphql` parser (already a dependency), extracts top-level field names, and checks against the allowlist. Security: batched requests mixing public and private operations require auth (all fields must be in the allowlist). Future enhancement: when the user-service adds `@tag(name: "public")` to its schema, the gateway can auto-detect these and merge with the env-based list.

---

## ADR-010: Token Revocation — Redis Blacklist with Fail-Open

**Date**: 2026-04-10
**Status**: Accepted

**Context**: The gateway performs stateless JWT verification. Revoked tokens (after logout, password change) remain valid until expiry. The question was how to implement token revocation at the gateway level.

**Options considered**:
1. **Redis token blacklist** — Gateway checks Redis `EXISTS revoked:jwt:{jti}` after JWT verification. Immediate invalidation, ~1ms overhead per request.
2. **Token introspection endpoint** — Gateway calls user-service to validate each token. Immediate but adds 5-50ms latency per request and creates availability coupling.
3. **Redis pub/sub + in-memory set** — User-service publishes revocation events, gateway subscribes. Near-real-time with zero per-request overhead. Higher complexity.
4. **Polling-based blacklist** — Gateway polls periodically for newly revoked tokens. Configurable delay, no per-request overhead.
5. **Short TTL + refresh tokens** — Very short access tokens (2-5 min). Bounded revocation window but no immediate invalidation.

**Decision**: Redis token blacklist with fail-open semantics.

**Rationale**: Best balance of simplicity, reliability, and latency. Redis is already planned for rate limiting (ADR-006). The ~1ms per-request overhead is negligible versus subgraph round-trips. Fail-open design: if Redis is unavailable, the gateway falls back to stateless JWT verification (current behavior). This prioritizes availability over security — a Redis outage does not lock out all users. The risk window is bounded by token TTL (1 hour). The feature is opt-in (`TOKEN_REVOCATION_ENABLED=false` by default) and gracefully degrades when `jti` is absent from the JWT (user-service must add `jti` for revocation to function).
