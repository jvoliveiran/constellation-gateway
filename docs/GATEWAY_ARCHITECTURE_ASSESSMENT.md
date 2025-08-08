### Constellation Gateway – Architecture & Quality Assessment

This document is an end-to-end assessment of the NestJS-based Apollo Federation Gateway in this repository. It covers current behavior, risks, and prioritized recommendations across security, reliability, observability, performance, developer experience, and delivery.


## Executive Summary
- **Overall**: Solid minimal gateway skeleton with Apollo Gateway v2, NestJS, Winston logging, and a basic health endpoint. Composition uses `IntrospectAndCompose` against a single subgraph from `SUBGRAPH` env.
- **Key gaps (must-do)**:
  - **Security**: No request context/JWT verification; sensitive header passthrough; CORS too permissive for prod; missing HTTP hardening.
  - **Resilience**: No subgraph timeouts/retries/circuit-breaking; no startup/readiness checks for subgraphs; healthcheck pings Google instead of dependencies.
  - **Federation**: Only single subgraph supported; no static supergraph in prod; no schema checks in CI.
  - **Perf/Abuse controls**: No query complexity/depth limits or rate limiting; no caching/persisted queries; introspection and landing page enabled by default.
  - **Observability**: No tracing/metrics; logs only. No correlation IDs; no structured request/event logs.
  - **DX/Quality**: TS strictness is off; config unvalidated; Docker image includes dev deps and runs as root; tests reference non-existent Prisma service; minimal test coverage.


## Current Architecture Overview
- **Framework**: NestJS 10, Apollo Gateway v2 via `@nestjs/apollo`.
- **Entry**: `src/main.ts` enables CORS and Winston logger, reads `SERVICE_PORT` via `ConfigService`.
- **Gateway**: `src/app.module.ts` configures `GraphQLModule.forRootAsync` with `ApolloGatewayDriver`:
  - Composition: `IntrospectAndCompose` using a single subgraph from `SUBGRAPH` env (format: `name|url`).
  - DataSource: `RemoteGraphQLDataSource` forwarding `userId`, `authorization`, `permissions` from context.
  - Auth/context: commented `handleAuth` stub (JWT verification TODO).
  - Apollo landing page enabled (Playground disabled).
- **Health**: `GET /health` using Terminus; pings `https://google.com` only.
- **Logging**: `nest-winston` with console transport at `debug`.
- **Config**: `@nestjs/config` without schema validation. `.env` usage implicit.
- **Tests**: E2E Jest config present, but no e2e specs; test factory references `PrismaService` (does not exist).
- **Docker**: Multi-stage build; final image copies `node_modules` from build layer (dev deps leak) and runs as root.


## Detailed Findings & Recommendations

### 1) Security & Compliance
- **Missing request authentication**
  - Current: `handleAuth` commented in `app.module.ts`; gateway forwards headers blindly.
  - Risks: Unauthenticated access to subgraphs; spoofed headers; inconsistent auth across services.
  - Must-have:
    - Implement a robust `context` builder that verifies JWT (clock skew, audience/issuer, key rotation with JWKS), extracts minimal claims (subject, roles/permissions), and rejects invalid requests early.
    - Avoid forwarding raw `Authorization` unless subgraphs must re-verify; prefer signed downstream token (service token) or pass vetted claims via whitelisted headers.
- **HTTP hardening**
  - Add `helmet` with sensible defaults; disable `x-powered-by`; configure `compression`.
  - Configure strict CORS via env (allow-list domains; methods/headers minimal; credentials only if required).
- **Abuse and DoS controls**
  - Add IP/user-based rate limiting on `/graphql`.
  - Enforce GraphQL depth and complexity limits to prevent expensive queries.
- **Secrets & config**
  - Validate env with a schema (Joi/Zod) and fail fast.
  - Support JWKS or key rotation for JWT verification.


### 2) Federation & Composition
- **Multi-subgraph support**
  - Current: single subgraph via `SUBGRAPH` env; README notes TODO.
  - Must-have: Accept multiple subgraphs (comma-separated or JSON), validate URLs, and build `IntrospectAndCompose` with all subgraphs.
- **Production supergraph**
  - Prefer static `supergraph.graphql` at runtime to avoid startup introspection flakiness and to enable CI-controlled schema changes. Keep a fallback to introspection for local/dev.
  - Add CI step using Rover to compose and validate (breaking change checks) before deploy.
- **Subgraph identity & security**
  - Propagate a gateway identity header or mTLS to subgraphs. If subgraphs depend on gateway-signed tokens, issue short-lived service tokens.
- **Gateway behavior for partial outages**
  - Define strategy for subgraph failures (fail-fast vs partial data where possible). Customize `RemoteGraphQLDataSource` hooks to map downstream errors consistently.


### 3) Resilience & Reliability
- **Timeouts, retries, and circuit breaking**
  - Configure per-subgraph timeouts and capped retries with backoff.
  - Add circuit-breaking or bulkheading to avoid cascading failures.
- **Health, liveness, readiness**
  - `/health` should check subgraphs (e.g., POST to `/graphql` lightweight query or introspection) and surface individual statuses.
  - Add `/ready` that verifies supergraph loaded and subgraphs reachable within thresholds.
- **Graceful shutdown**
  - Enable shutdown hooks and handle `SIGTERM`/`SIGINT` correctly; drain in-flight requests; set server timeouts.


### 4) Observability
- **Distributed tracing**
  - Integrate OpenTelemetry (SDK + Nest instrumentation + GraphQL and HTTP spans). Export to OTLP collector; correlate across subgraphs.
- **Metrics**
  - Expose Prometheus metrics (request rate, latency, error % by operation/subgraph, cache hit rate, composition time). Add RED/SLA dashboards.
- **Structured, correlated logging**
  - Attach correlation/request IDs (e.g., via middleware); include operationName, variables size/hash, userId (if present), subgraph timings.
  - Redact sensitive headers and tokens in logs.
- **Error handling**
  - Consistent error formatting and masking; avoid leaking internal details; map subgraph errors into safe shapes.


### 5) Performance & Cost
- **Caching**
  - Enable gateway-level operation cache and response caching where feasible (respecting auth scopes). Consider full-page CDN caching for public queries.
  - Use `@apollo/utils.keyvaluecache` (e.g., Redis) and set appropriate TTLs.
- **Persisted queries & safelisting**
  - Adopt Automatic Persisted Queries (APQ) and/or safelisted operations to reduce payloads and block arbitrary queries in prod.
- **Query cost controls**
  - Enforce depth/complexity limits; optionally implement cost-based scoring per field.
- **Compression & transport**
  - Enable gzip/br compression; consider HTTP/2 and connection pooling between gateway and subgraphs.


### 6) Developer Experience & Code Quality
- **TypeScript strictness**
  - `tsconfig.json` has `strictNullChecks: false`, `noImplicitAny: false`. Enable full strict mode for correctness.
- **Config validation & defaults**
  - Use `ConfigModule.forRoot({ validate })` with a schema; supply sensible defaults for dev.
- **Testing**
  - Remove `PrismaService` import from `test/factory/create-test-module.ts` (file doesn’t exist).
  - Add unit tests for context/auth builder, header propagation, error mapping; e2e tests covering composition, auth failure, and subgraph outage.
- **Linting/formatting**
  - Lint rules are minimal; consider enabling more strict rules (explicit return types, no-floating-promises, etc.). Add commit hooks with Husky + lint-staged.


### 7) Delivery & Runtime
- **Docker image hardening**
  - Do not copy `node_modules` from build layer into final image. Use `npm ci --omit=dev` in final stage, copy only `dist/` and necessary assets.
  - Add a non-root user, drop privileges, set `NODE_ENV=production`, and include a Docker `HEALTHCHECK`.
  - Add `.dockerignore` to reduce context size.
- **Configuration via env**
  - Parameterize CORS origin(s), enable/disable landing page and introspection per env.
- **Kubernetes** (if applicable)
  - Provide manifests with liveness/readiness probes, resource limits/requests, PodDisruptionBudget, HPA on CPU/RPS, and graceful termination period.


## Prioritized Backlog

- **P0 – Must-have (Security/Resilience/Prod readiness)**
  - Implement JWT/JWKS-based `context` auth; pass only vetted claims to subgraphs.
  - Strict CORS + `helmet` + compression; disable landing page and introspection in prod.
  - Multi-subgraph support from env; validate config; fail-fast on invalid config.
  - Switch to static supergraph for prod; add CI composition/validation via Rover.
  - Add timeouts/retries for subgraph requests; graceful shutdown; readiness endpoint.
  - Replace Google ping with subgraph health checks; surface aggregated status.
  - Add depth/complexity limits and basic rate limiting.
  - Fix Dockerfile to avoid dev deps and run as non-root; add `.dockerignore` and `HEALTHCHECK`.

- **P1 – High impact (Observability/Performance)**
  - OpenTelemetry tracing and Prometheus metrics; add correlation IDs and structured logs with redaction.
  - Redis-backed cache, APQ/persisted queries; gzip/br compression; HTTP/2 where supported.

- **P2 – DX & Quality**
  - Enable TS strict mode; config schema validation; stronger ESLint rules; pre-commit hooks.
  - Replace broken test factory; add unit + e2e tests for core flows; CI with lint/test/coverage gates.


## Suggested Interfaces & Config (Illustrative)

- **Env**
  - `SERVICE_PORT` (number, default 3000)
  - `GATEWAY_ENV` (dev|staging|prod)
  - `SUBGRAPHS` (comma-separated: `name|url,name|url`)
  - `STATIC_SUPERGRAPH_PATH` (prod only)
  - `JWT_ISSUER`, `JWT_AUDIENCE`, `JWKS_URI`
  - `CORS_ORIGINS` (comma-separated)
  - `OTEL_EXPORTER_OTLP_ENDPOINT`, `PROMETHEUS_PORT`

- **Composition**
  - Dev: `IntrospectAndCompose` with multiple subgraphs, small poll interval.
  - Prod: Load `supergraph.graphql`, disable introspection and landing page.


## Notable Code References
- `src/app.module.ts`: Gateway configuration, commented auth, header forwarding, `IntrospectAndCompose` single subgraph.
- `src/main.ts`: CORS, Winston logger registration, port from config.
- `src/health/*`: Health controller/module; pings Google only.
- `test/factory/create-test-module.ts`: References non-existent `PrismaService` (cleanup needed).
- `dockerfile`: Copies `node_modules` from build stage into final image (pulls dev deps), runs as root.
- `tsconfig.json`: Strictness disabled; potential for type-related defects.


## Appendix: Quick Wins Checklist
- [ ] Implement JWT/JWKS auth context and restrict header forwarding
- [ ] Support multiple subgraphs; validate config on boot
- [ ] Adopt static supergraph in prod + CI Rover checks
- [ ] Timeouts/retries + graceful shutdown + readiness probe
- [ ] Healthcheck for subgraphs (replace Google ping)
- [ ] Disable landing page/introspection in prod; add query depth/complexity limits
- [ ] Add tracing + metrics + correlation IDs; redact logs
- [ ] Harden Dockerfile; .dockerignore; non-root; healthcheck
- [ ] TS strict mode; config schema validation; stronger lint rules
- [ ] Fix tests; add unit/e2e; CI gates 