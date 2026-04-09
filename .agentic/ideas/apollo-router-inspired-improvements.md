# Apollo Router-Inspired Improvements for Constellation Gateway

## Context

This document captures findings from comparing **Apollo Router** (Rust-based standalone binary) with our current **Apollo Gateway** (`@apollo/gateway` ^2.7.1) setup running inside NestJS. The goal is to identify patterns and ideas we can adopt without migrating away from the Node.js stack.

---

## Current Architecture Overview

- **Gateway library**: `@apollo/gateway` ^2.7.1 via `ApolloGatewayDriver` in NestJS
- **Subgraph registration**: `SUBGRAPH` env var parsed as `name|url,name|url` strings, fed into `IntrospectAndCompose`
- **Header propagation**: Hardcoded in `willSendRequest` inside `RemoteGraphQLDataSource` (`src/app.module.ts:84-114`)
- **Supergraph composition**: `rover supergraph compose` via npm script, using `supergraph-config.yml`
- **Propagated context**: `authorization`, `userId`, `permissions`, `x-correlation-id`, and OpenTelemetry W3C trace headers

---

## How Apollo Router Handles These Concerns

### Supergraph Schema (Service Registration)

Router uses a **two-layer model**:

1. **Compose time** — `rover supergraph compose` reads a `supergraph-config.yaml` that lists each subgraph's name, routing URL, and schema source (file, introspection URL, or GraphOS reference). It produces a single `supergraph.graphql` SDL that encodes routing URLs inside the schema itself.
2. **Runtime** — Router loads the composed SDL and knows where every subgraph lives. No code, no env var parsing.

Dynamic updates are possible via **Apollo Uplink** (GraphOS managed) — when a subgraph schema is published, Router picks up the new composed schema automatically.

### Header Propagation (router.yaml)

Router uses a **declarative YAML configuration** for header propagation:

```yaml
headers:
  all:  # Rules applied to all subgraphs
    request:
      - propagate:
          matching: "^x-custom-.*"     # regex matching
      - propagate:
          named: "authorization"       # specific header
      - propagate:
          named: "x-correlation-id"
      - remove: "X-Internal-Only"      # strip before forwarding
      - insert:
          name: "X-Gateway-Version"
          value: "1.0"                  # inject static headers

  subgraphs:
    payments:  # Per-subgraph overrides
      request:
        - insert:
            name: "X-Service-Token"
            value: "${env.PAYMENTS_TOKEN}"
        - propagate:
            named: "X-Idempotency-Key"
```

Key operations:
- **propagate**: forward headers from client to subgraph (named, regex matching, with optional rename/default)
- **insert**: add static or env-driven headers
- **remove**: strip headers before forwarding

Rule ordering matters — first matching rule wins for a given header.

### Per-Subgraph Configuration

Router supports per-subgraph settings for timeout, retry, and header rules. Each subgraph can behave differently at the routing layer without code changes.

---

## Improvement Ideas

### 1. Declarative Header Propagation Config

**Problem**: Header propagation is hardcoded in `willSendRequest` with individual `if` statements. Adding a new header requires a code change, review, and deployment.

**Idea**: Define header propagation rules in configuration and build a generic engine in `willSendRequest` that applies them.

**Proposed types**:

```typescript
interface PropagateRule {
  type: 'propagate';
  named?: string;        // exact header name
  matching?: string;     // regex pattern
  rename?: string;       // rename header before forwarding
  default?: string;      // fallback value if header is absent
}

interface InsertRule {
  type: 'insert';
  name: string;
  value: string;
}

interface RemoveRule {
  type: 'remove';
  named: string;
}

type HeaderRule = PropagateRule | InsertRule | RemoveRule;

interface HeaderConfig {
  all?: { request: HeaderRule[] };
  subgraphs?: Record<string, { request: HeaderRule[] }>;
}
```

**Benefits**:
- Adding/removing propagated headers becomes a config change
- Per-subgraph header overrides without touching gateway code
- Easier to audit what gets forwarded where

**Trade-off**: Slightly more complex initial setup, but pays off as subgraph count grows.

### 2. YAML-Based Subgraph Registration with Per-Service Config

**Problem**: Current `SUBGRAPH=name|url,name|url` env var is flat — no way to configure per-subgraph timeout, headers, or retry behavior.

**Idea**: Extend `supergraph-config.yml` or introduce a separate `gateway.yml` for richer per-subgraph runtime config:

```yaml
subgraphs:
  constellation:
    url: http://localhost:3001/graphql
    timeout: 5000
    headers:
      - type: insert
        name: X-Source
        value: gateway
  payments:
    url: http://localhost:3002/graphql
    timeout: 10000
    headers:
      - type: propagate
        named: X-Idempotency-Key
```

**Implementation notes**:
- Parse YAML at startup alongside Zod validation
- Extend `SubgraphConfig` interface to include `timeout` and `headers`
- Use per-subgraph config in `buildService` to create differently-configured `RemoteGraphQLDataSource` instances
- Keep env var override as fallback for simple deployments (e.g., `SUBGRAPH` still works if no YAML present)

### 3. Generic `willSendRequest` Engine

**Problem**: The current `willSendRequest` knows about specific context fields (`userId`, `authorization`, `permissions`, `correlationId`). This couples the gateway to the shape of the auth context.

**Idea**: Replace hardcoded field forwarding with a rule-based engine:

```typescript
buildService: ({ name, url }) => {
  const subgraphHeaders = resolveHeaderRules(name, headerConfig);

  return new RemoteGraphQLDataSource({
    url,
    willSendRequest({ request, context }) {
      // Always propagate OTel trace context
      propagation.inject(otelContext.active(), request.http?.headers, {
        set: (carrier, key, value) => carrier?.set(key, value),
      });

      // Apply declarative header rules
      for (const rule of subgraphHeaders) {
        applyHeaderRule(rule, request, context);
      }
    },
  });
};
```

This separates the **engine** (how to apply rules) from the **policy** (what to propagate).

### 4. Subgraph Health-Aware Routing

**Problem**: `IntrospectAndCompose` introspects at startup but has no ongoing awareness of subgraph health.

**Idea**: Combine the existing `HealthModule` with subgraph health checks. Periodically poll subgraph health endpoints and surface their status in the gateway's own `/health` endpoint. This mirrors Router's built-in health awareness.

### 5. OpenTelemetry Context Propagation as a First-Class Config

**Problem**: OTel propagation is hardcoded alongside business header propagation in `willSendRequest`.

**Idea**: Treat OTel propagation as a built-in, always-on behavior (like Router does) rather than mixing it with configurable header rules. Extract it into its own layer so it cannot be accidentally removed or misconfigured.

---

## Migration Path (if ever moving to Apollo Router)

For reference, if the decision is ever made to adopt Apollo Router:

1. Extract all NestJS gateway-level middleware (auth, throttling, correlation ID) into a **Router coprocessor** or **Rhai plugin**
2. Move header propagation rules to `router.yaml`
3. Keep NestJS services as federated subgraphs only
4. Deploy Router as a separate container/process in front of the subgraph fleet
5. Remove `@apollo/gateway`, `ApolloGatewayDriver`, and the `GraphQLModule` gateway config from `app.module.ts`

**Note**: Apollo Router is licensed under **Elastic License v2 (ELv2)** — source-available but not open source. The main restriction is you cannot offer it as a hosted/managed service. Fine for internal deployments.

---

## Priority Ranking

| Idea | Effort | Impact | Suggested Priority |
|---|---|---|---|
| Declarative header propagation config | Medium | High | 1 |
| Generic `willSendRequest` engine | Medium | High | 2 |
| YAML-based subgraph registration | Low-Medium | Medium | 3 |
| OTel propagation as built-in layer | Low | Medium | 4 |
| Subgraph health-aware routing | Medium | Low-Medium | 5 |
