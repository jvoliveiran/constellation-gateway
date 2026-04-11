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
