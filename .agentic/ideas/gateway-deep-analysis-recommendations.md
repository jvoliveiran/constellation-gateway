# Constellation Gateway — Deep Analysis & Recommended Changes

## Context

This document captures findings from a comprehensive analysis of the gateway codebase, evaluating it as a GraphQL federated gateway serving as the entrypoint for a distributed architecture based on supergraph composition. Each recommendation targets a specific gap in security, reliability, performance, observability, or quality.

---

## HIGH PRIORITY

### 1. Switch from `IntrospectAndCompose` to Static Supergraph

**Current**: Gateway introspects subgraphs at startup via `IntrospectAndCompose`.

**Problem**: If a subgraph is down at gateway boot, the entire gateway fails to start. No schema versioning, no rollback capability, no schema change validation before deployment.

**Recommendation**: Use Apollo Managed Federation (GraphOS) or load a pre-composed `supergraph.graphql` at startup (`rover supergraph compose` is already configured). This decouples gateway availability from subgraph availability at boot time.

**Effort**: Medium | **Impact**: Reliability

---

### 2. Add Query Cost / Complexity Analysis

**Current**: Only `graphql-depth-limit` (depth=10).

**Problem**: A shallow but wide query (e.g., fetching 1000 items with 20 fields each) bypasses depth limiting entirely.

**Recommendation**: Add `graphql-query-complexity` or `@escape.tech/graphql-armor` to enforce cost-based limits. Critical for a public-facing gateway.

**Effort**: Low | **Impact**: Security

---

### 3. Add Response Caching Strategy

**Current**: No caching at any level.

**Problem**: Every identical query hits all subgraphs every time, increasing latency and load.

**Recommendation**: Implement Automatic Persisted Queries (APQ) at minimum. Consider `@apollo/server-plugin-response-cache` or a Redis-backed cache layer for public/semi-public queries with `Cache-Control` hints from subgraphs.

**Effort**: Medium | **Impact**: Performance

---

### 4. Improve JWT Auth Robustness

**Current**: HS256 (symmetric) with `jsonwebtoken.verify()`.

**Problems**:
- HS256 means the same secret signs and verifies — any service with the secret can forge tokens
- No `issuer` or `audience` validation
- No token expiration enforcement beyond `jsonwebtoken` defaults
- No key rotation mechanism

**Recommendation**: Migrate to RS256/ES256 (asymmetric) with JWKS endpoint support. Add `issuer`, `audience`, and explicit `algorithms` options to `verify()`. Consider `passport-jwt` or a dedicated auth service.

**Effort**: Medium | **Impact**: Security

---

### 5. Add E2E / Integration Tests

**Current**: E2E test infrastructure exists (`test/jest-e2e.json`, `createTestModule`) but no actual E2E tests.

**Problem**: No validation that the gateway correctly composes and proxies queries to subgraphs.

**Recommendation**: Add E2E tests with mocked subgraphs (e.g., using `@apollo/server` to spin up test subgraphs) that validate: query forwarding, error propagation, auth header forwarding, rate limiting behavior, health endpoints.

**Effort**: Medium | **Impact**: Quality

---

## MEDIUM PRIORITY

### 6. Add Request/Operation Logging

**Current**: Winston logger is configured but no structured request logging showing which GraphQL operations are executed.

**Recommendation**: Add an Apollo Server plugin that logs `operationName`, `query hash`, `duration`, `errors`, and `userId` for every request. Essential for debugging and audit trails.

**Effort**: Low | **Impact**: Observability

---

### 7. Implement Graceful Subgraph Degradation

**Current**: If a subgraph is unreachable during a query, Apollo returns a full error.

**Recommendation**: Add circuit breaker patterns (e.g., `opossum`) for subgraph calls. Consider `@defer`/`@stream` support when available. At minimum, configure retry logic in `RemoteGraphQLDataSource`.

**Effort**: Medium | **Impact**: Reliability

---

### 8. Tighten CORS Configuration

**Current**: CORS methods include `PUT, PATCH, DELETE` which are irrelevant for a GraphQL gateway (only `GET, POST, OPTIONS` are used). Default `ALLOWED_ORIGINS` is `http://localhost:3002`.

**Recommendation**: Restrict CORS methods to `GET, POST, OPTIONS`. Validate that production configs don't contain `localhost`.

**Effort**: Low | **Impact**: Security

---

### 9. Strengthen Rate Limiting

**Current**: Global rate limiting by IP (100 req/60s) via `@nestjs/throttler`.

**Problems**:
- No per-operation differentiation (query costs same as mutation)
- No user-based rate limiting (authenticated users share IP limits behind proxies)
- No consideration for `X-Forwarded-For` in load-balanced environments

**Recommendation**: Add operation-type-aware rate limiting. Use `userId` from JWT for authenticated rate limits. Configure trust proxy for `X-Forwarded-For`.

**Effort**: Medium | **Impact**: Security

---

### 10. Add Schema Change Validation in CI

**Current**: `rover supergraph compose` exists as npm script but isn't part of CI.

**Recommendation**: Add a CI step that runs `rover subgraph check` against all subgraphs before deploying. Catches breaking schema changes before production.

**Effort**: Low | **Impact**: Quality

---

### 11. Improve Docker Image Security

**Current**: `node:20-alpine` with `npm ci --omit=dev`.

**Missing**:
- No non-root user (runs as root by default)
- No `.dockerignore` to exclude unnecessary files
- No image scanning step

**Recommendation**: Add `USER node` directive, create `.dockerignore`, add `npm audit` or Trivy scan in CI.

**Effort**: Low | **Impact**: Security

---

### 12. Add Prometheus `/metrics` Endpoint Authorization

**Current**: `/metrics` is marked `@Public()` — anyone can scrape it.

**Problem**: Metrics can expose internal operation names, error rates, and system characteristics.

**Recommendation**: Restrict `/metrics` to internal network or add a separate API key for metrics scraping.

**Effort**: Low | **Impact**: Security

---

## LOW PRIORITY

### 13. Add Request Timeout per Operation

**Current**: Global `SUBGRAPH_TIMEOUT_MS` (30s) for all operations.

**Recommendation**: Allow per-operation timeouts via directives or operation-specific config. Mutations may need longer timeouts than queries.

**Effort**: Low | **Impact**: Performance

---

### 14. Add Gateway-Level Error Classification

**Current**: `formatError` strips stack traces in production but doesn't classify errors.

**Recommendation**: Add error classification (e.g., `UNAUTHENTICATED`, `RATE_LIMITED`, `SUBGRAPH_UNAVAILABLE`, `VALIDATION_ERROR`) with structured error codes in `extensions.code`.

**Effort**: Low | **Impact**: DX

---

### 15. Add Subscription Support (WebSocket)

**Current**: No WebSocket/subscription support.

**Recommendation**: If real-time features are planned, add `graphql-ws` with Apollo's subscription support. Federation v2 supports subscriptions via callback protocol.

**Effort**: High | **Impact**: Features

---

### 16. Disable Introspection in Production

**Current**: GraphQL introspection is implicitly enabled (Apollo default).

**Recommendation**: Disable introspection in production via config flag. Introspection exposes the entire schema to any authenticated user.

**Effort**: Low | **Impact**: Security

---

### 17. Improve GqlThrottlerGuard Test Coverage

**Current**: Only 1 test (verifies class exists).

**Recommendation**: Add tests for: rate limit exceeded scenario, GraphQL context extraction, different operation types.

**Effort**: Low | **Impact**: Quality

---

### 18. Add GraphQL Linting

**Current**: No GraphQL-specific linting.

**Recommendation**: Add `@graphql-eslint/eslint-plugin` to lint `.graphql` files or inline operations during development.

**Effort**: Low | **Impact**: Quality

---

### 19. Configure `trust proxy`

**Current**: Express app doesn't configure `trust proxy`.

**Problem**: Behind a load balancer/reverse proxy, `req.ip` returns the proxy IP, not the client IP. This breaks rate limiting and audit logging.

**Recommendation**: Add configurable `app.set('trust proxy', ...)` in `main.ts`.

**Effort**: Low | **Impact**: Ops

---

### 20. Add Subgraph Health Check Timeout

**Current**: Readiness probe pings subgraphs but doesn't configure a timeout for each ping.

**Recommendation**: Add a configurable timeout (e.g., 5s) per subgraph health check to prevent the readiness probe from hanging if a subgraph is slow to respond.

**Effort**: Low | **Impact**: Reliability

---

## Summary Matrix

| # | Recommendation | Priority | Effort | Impact |
|---|---------------|----------|--------|--------|
| 1 | Static/managed supergraph composition | High | Medium | Reliability |
| 2 | Query cost/complexity analysis | High | Low | Security |
| 3 | Response caching (APQ + cache layer) | High | Medium | Performance |
| 4 | JWT auth hardening (RS256, JWKS, claims) | High | Medium | Security |
| 5 | E2E tests with mock subgraphs | High | Medium | Quality |
| 6 | Structured operation logging | Medium | Low | Observability |
| 7 | Circuit breaker for subgraphs | Medium | Medium | Reliability |
| 8 | CORS tightening | Medium | Low | Security |
| 9 | Per-user/operation rate limiting | Medium | Medium | Security |
| 10 | Schema validation in CI | Medium | Low | Quality |
| 11 | Docker image hardening | Medium | Low | Security |
| 12 | Metrics endpoint auth | Medium | Low | Security |
| 13 | Per-operation timeouts | Low | Low | Performance |
| 14 | Error classification system | Low | Low | DX |
| 15 | WebSocket/subscription support | Low | High | Features |
| 16 | Introspection toggle | Low | Low | Security |
| 17 | Throttler guard tests | Low | Low | Quality |
| 18 | GraphQL ESLint | Low | Low | Quality |
| 19 | Trust proxy config | Low | Low | Ops |
| 20 | Health check timeout config | Low | Low | Reliability |
