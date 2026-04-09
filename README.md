<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Constellation Gateway

A production-ready NestJS-based Apollo Federation Gateway that loads a pre-composed supergraph schema at startup and exposes a unified GraphQL endpoint for clients.

### Requirements
- Node.js 20 (`.nvmrc` provided)
- npm 9+
- Optional: Docker 24+
- Optional: Rover CLI for static supergraph composition (`@apollo/rover` available via `npx`)

### Quick start
1. Install dependencies:
```bash
npm install
```
2. Create an `.env` from the provided template:
```bash
cp .env.example .env
```
3. Update `.env` with your values (at minimum `JWT_SECRET`).
4. **Generate the supergraph schema** (requires subgraphs running):
```bash
make supergraph
```
> **CRITICAL:** The gateway loads `supergraph.graphql` at startup. If this file is missing, the gateway will fail to start. You must run `make supergraph` (or `npm run supergraph`) whenever a subgraph schema changes and commit the updated `supergraph.graphql` to the repo.
5. Run in watch mode:
```bash
npm run dev
```
5. Access:
- GraphQL: `http://localhost:3000/graphql` (Apollo landing page enabled in development)
- Health: `http://localhost:3000/health`
- Readiness: `http://localhost:3000/health/ready`
- Metrics: `http://localhost:3000/metrics`

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | NestJS (Express) | 10.x |
| GraphQL | Apollo Gateway (Federation v2) | 2.7.x |
| Language | TypeScript (strict mode) | 5.x |
| Runtime | Node.js | 20 |
| Auth | jsonwebtoken (JWT) | 9.x |
| Logging | Winston via nest-winston | 3.x / 1.9.x |
| Metrics | prom-client (Prometheus) | 15.x |
| Tracing | OpenTelemetry (OTLP) | 0.213.x |
| Health checks | @nestjs/terminus | 10.x |
| Rate limiting | @nestjs/throttler | 6.x |
| Security headers | helmet | 8.x |
| Config validation | Zod | 4.x |
| Testing | Jest + ts-jest + Supertest | 29.x |

### Environment

All environment variables are validated at startup via Zod. The application refuses to start if required variables are missing or malformed.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `NODE_ENV` | string | `development` | No | `development`, `production`, or `test` |
| `SERVICE_PORT` | number | `3000` | No | Port the gateway listens on |
| `SUPERGRAPH_PATH` | string | `./supergraph.graphql` | No | Path to the pre-composed supergraph SDL file |
| `SUBGRAPH` | string | — | No | Subgraph definitions in `name\|url` format, comma-separated (used only for `/health/ready` pings) |
| `JWT_SECRET` | string | — | **Yes** | Secret for JWT verification (min 32 characters) |
| `ALLOWED_ORIGINS` | string | `http://localhost:3002` | No | Comma-separated CORS origins |
| `RATE_LIMIT_TTL` | number | `60` | No | Rate limit window in seconds |
| `RATE_LIMIT_MAX` | number | `100` | No | Max requests per rate limit window |
| `QUERY_MAX_DEPTH` | number | `10` | No | Maximum allowed GraphQL query depth |
| `SUBGRAPH_TIMEOUT_MS` | number | `30000` | No | Subgraph request timeout in milliseconds |
| `LOG_LEVEL` | string | `info` | No | Log level: `error`, `warn`, `info`, `debug` |
| `OTEL_SDK_DISABLED` | boolean | `true` | No | Disable OpenTelemetry tracing |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | string | — | No | OTLP endpoint for traces (e.g. Grafana Cloud Tempo) |
| `OTEL_EXPORTER_OTLP_HEADERS` | string | — | No | OTLP auth headers (e.g. `Authorization=Basic <token>`) |

Multi-subgraph example:
```env
SUBGRAPH=constellation|http://localhost:3001/graphql,users|http://localhost:3002/graphql
```

### Security
- **JWT Authentication**: All GraphQL requests require a valid `Authorization: Bearer <token>` header. The guard verifies the token using `JWT_SECRET` and attaches `userId` and `permissions` to the request context. Health and metrics endpoints are public.
- **Query Depth Limiting**: Rejects queries exceeding `QUERY_MAX_DEPTH` (default: 10) to prevent abuse.
- **Rate Limiting**: Global throttle via `@nestjs/throttler` — configurable window and max requests.
- **Helmet**: Sets security headers (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, etc.). CSP is disabled to allow the Apollo landing page in development.
- **CORS**: Configurable origins via `ALLOWED_ORIGINS`. Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- **Error Formatting**: In production, GraphQL error responses strip stack traces and internal details.

### GraphQL Gateway
- **Driver**: `@apollo/gateway` v2 via `@nestjs/graphql` + `@nestjs/apollo` (Apollo Gateway driver).
- **Composition**: Static supergraph — the gateway loads a pre-composed `supergraph.graphql` file at startup. No subgraph introspection at boot time, decoupling gateway availability from subgraph availability.
- **Endpoint**: `/graphql`.
- **Landing Page**: Apollo Server landing page enabled in development, disabled in production.
- **Header forwarding**: A custom `RemoteGraphQLDataSource` forwards the following headers to subgraphs:
  - `userId` — from verified JWT payload
  - `authorization` — original bearer token
  - `permissions` — JSON-encoded array from JWT payload
  - `x-correlation-id` — request correlation ID for distributed tracing

### Observability

The gateway is designed to integrate with **Grafana Cloud** (free tier) but uses standard, vendor-neutral protocols.

#### Logging
- **Production**: Structured JSON (Loki-compatible) with `service: "constellation-gateway"` label
- **Development**: NestJS-style pretty output with colors
- **Level**: Configurable via `LOG_LEVEL`

#### Metrics
- **Endpoint**: `GET /metrics` (Prometheus text format)
- **Custom metrics**:
  - `gateway_http_requests_total` — counter with `method`, `status_code`, `operation_name` labels
  - `gateway_http_request_duration_seconds` — histogram with `method`, `operation_name` labels
  - `gateway_graphql_errors_total` — counter with `operation_name`, `error_type` labels
- **Default metrics**: Node.js process metrics (event loop lag, memory, GC) prefixed with `gateway_`
- **Integration**: Grafana Agent or Alloy scrapes `/metrics` and remote-writes to Grafana Cloud Mimir

#### Tracing
- **Protocol**: OpenTelemetry (OTLP over HTTP) via `@opentelemetry/sdk-node`
- **Auto-instrumentation**: HTTP, Express, and GraphQL
- **Propagation**: W3C Trace Context (`traceparent` header forwarded to subgraphs)
- **Integration**: Exported to Grafana Cloud Tempo (or any OTLP-compatible backend)
- **Toggle**: Disabled by default via `OTEL_SDK_DISABLED=true`

#### Correlation IDs
- Every request gets an `X-Correlation-ID` header (read from incoming request or generated via `crypto.randomUUID()`)
- Forwarded to all subgraphs and included in response headers

#### Health Checks
| Endpoint | Purpose | Details |
|----------|---------|---------|
| `GET /health` | Liveness | Gateway process is alive |
| `GET /health/ready` | Readiness | Subgraphs are reachable (only when `SUBGRAPH` env var is set; returns OK otherwise) |

### Running
```bash
npm run dev           # Development (watch mode)
npm run start:debug   # Debug mode with watch
npm run build && npm run start:prod   # Production
```

### Docker
Multi-stage build using `node:20` for compilation and `node:20-alpine` for the production image.

```bash
# Build
docker build -t constellation-gateway -f dockerfile .

# Run
docker run --rm -p 3000:3000 --env-file .env constellation-gateway
```

#### Docker Compose
```bash
docker compose up -d    # Start all services
docker compose down     # Stop all services
```

The `docker-compose.yml` includes a gateway service with health checks and a placeholder subgraph service.

#### Makefile
Common commands are available via `make`:

| Command | Description |
|---------|-------------|
| `make dev` | Start development server |
| `make test` | Run tests with coverage |
| `make test-e2e` | Run E2E tests |
| `make lint` | Lint and fix |
| `make build` | Build for production |
| `make docker-build` | Build Docker image |
| `make docker-run` | Run Docker container |
| `make compose-up` | Start all services |
| `make compose-down` | Stop all services |
| `make supergraph` | Compose supergraph SDL from subgraph schemas (requires subgraphs running) |

### Testing
```bash
npm run test          # Unit tests
npm run test:watch    # Unit tests in watch mode
npm run test:cov      # Unit tests with coverage report
npm run test:e2e      # E2E tests
```

- **Framework**: Jest 29 with `ts-jest` transformer
- **Coverage**: ≥80% line coverage on source files
- **Unit tests**: `*.spec.ts` files under `src/`
- **E2E tests**: `*.e2e-spec.ts` files under `test/`

### Code Quality
- **TypeScript**: Strict mode enabled (`strict: true`)
- **Linting**: ESLint with `@typescript-eslint/recommended`, `no-explicit-any: warn`, `no-unused-vars: error`
- **Formatting**: Prettier (single quotes, trailing commas)
- **Config validation**: Zod schema validates all env vars at startup
- **Graceful shutdown**: `enableShutdownHooks()` drains in-flight requests on SIGTERM/SIGINT

### Supergraph Composition (Rover)

> **CRITICAL:** The `supergraph.graphql` file is the gateway's schema source of truth. It must be committed to the repo and kept up to date with subgraph schema changes. The gateway will **fail to start** if this file is missing or empty.

Generate or update the supergraph schema (requires subgraphs to be running):
```bash
make supergraph   # or: npm run supergraph
```

**Workflow for schema changes:**
1. A subgraph team changes their schema
2. Run `make supergraph` to regenerate `supergraph.graphql`
3. Commit the updated `supergraph.graphql` alongside the subgraph changes — the diff serves as a schema change review gate
4. The gateway deploys with the checked-in artifact — no subgraph network calls at boot time

The composition is configured via `supergraph-config.yml`, which is the single source of truth for subgraph definitions used by Rover.

### Integrating Services (Subgraphs)

This gateway uses [Apollo Federation v2](https://www.apollographql.com/docs/federation/) to compose multiple GraphQL services (subgraphs) into a single unified API. Any GraphQL service that implements the Apollo Federation spec can be integrated.

#### Subgraph Requirements

Your service must:

1. **Implement the Apollo Federation v2 subgraph spec** — use `@apollo/subgraph` (Node.js), `async-graphql` (Rust), `caliban` (Scala), `gqlgen` with federation plugin (Go), or any [compatible library](https://www.apollographql.com/docs/federation/building-supergraphs/supported-subgraphs).
2. **Expose a GraphQL endpoint** reachable by the gateway over HTTP (e.g. `http://my-service:3001/graphql`).
3. **Return Federation directives** in its schema — at minimum `extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])`.

#### Configuration

Subgraphs are registered in `supergraph-config.yml` for schema composition via Rover:

```yaml
federation_version: 2
subgraphs:
  products:
    routing_url: http://localhost:3001/graphql
    schema:
      subgraph_url: http://localhost:3001/graphql
  users:
    routing_url: http://localhost:3002/graphql
    schema:
      subgraph_url: http://localhost:3002/graphql
```

After updating `supergraph-config.yml`, regenerate the supergraph:
```bash
make supergraph
```

**Optionally**, set the `SUBGRAPH` environment variable to enable `/health/ready` pings to subgraphs at runtime:

```env
SUBGRAPH=products|http://localhost:3001/graphql,users|http://localhost:3002/graphql
```

**Format rules for `SUBGRAPH`:**
- `name` — an alphanumeric identifier (supports hyphens and underscores: `[\w-]+`)
- `url` — the full HTTP(S) URL to the subgraph's GraphQL endpoint
- Entries are separated by commas (no spaces around the comma)
- Validated at startup via Zod — the gateway refuses to start if the format is invalid

#### Full `.env` Example

Below is a complete `.env` configuration for a gateway composing three subgraphs:

```env
# Server
NODE_ENV=production
SERVICE_PORT=3000

# Subgraphs — comma-separated name|url pairs
SUBGRAPH=products|http://products-service:3001/graphql,users|http://users-service:3002/graphql,orders|http://orders-service:3003/graphql
SUBGRAPH_TIMEOUT_MS=5000

# Security
JWT_SECRET=my-super-secret-key-that-is-at-least-32-chars
ALLOWED_ORIGINS=https://my-app.example.com,https://admin.example.com
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=200
QUERY_MAX_DEPTH=8

# Logging
LOG_LEVEL=info

# Tracing (optional — disabled by default)
OTEL_SDK_DISABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-east-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64(instanceId:apiKey)>
```

#### Docker Compose Example

To run the gateway alongside your subgraph services. Note: the gateway no longer needs `depends_on` for subgraphs at boot — it loads the checked-in `supergraph.graphql` instead.

```yaml
services:
  gateway:
    build:
      context: .
      dockerfile: dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      SERVICE_PORT: 3000
      SUBGRAPH: products|http://products:3001/graphql,users|http://users:3002/graphql  # optional — for /health/ready pings
      JWT_SECRET: my-super-secret-key-that-is-at-least-32-chars
      ALLOWED_ORIGINS: https://my-app.example.com
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  products:
    image: my-org/products-subgraph:latest
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3001/graphql?query=%7B__typename%7D"]
      interval: 10s
      timeout: 5s
      retries: 3

  users:
    image: my-org/users-subgraph:latest
    ports:
      - "3002:3002"
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3002/graphql?query=%7B__typename%7D"]
      interval: 10s
      timeout: 5s
      retries: 3
```

#### Headers Forwarded to Subgraphs

The gateway automatically forwards the following headers to every subgraph on each request:

| Header | Source | Description |
|--------|--------|-------------|
| `userId` | JWT payload | The authenticated user's ID |
| `authorization` | Incoming request | The original `Bearer <token>` header |
| `permissions` | JWT payload | JSON-encoded array of user permissions |
| `x-correlation-id` | Middleware | Unique request correlation ID for distributed tracing |

Your subgraph can read these headers to enforce authorization, identify the user, or propagate tracing context.

#### Verifying Integration

After adding a subgraph to `supergraph-config.yml` and regenerating the supergraph:

1. **Run `make supergraph`** — Rover composes the supergraph from all subgraph schemas. If a subgraph is unreachable or has schema errors, composition will fail with a clear message.
2. **Commit `supergraph.graphql`** — review the diff to verify the new subgraph's types are composed correctly.
3. **Start the gateway** — it loads the checked-in `supergraph.graphql` without contacting any subgraph.
4. **Query the composed schema** — in development, open `http://localhost:3000/graphql` to access the Apollo landing page and explore the composed supergraph schema.
5. **Hit the readiness endpoint** — if `SUBGRAPH` is set, `GET /health/ready` checks that all configured subgraphs are reachable. A `503` means one or more subgraphs are down.

### Project structure
```
constellation-gateway/
├── src/
│   ├── main.ts                            # Bootstrap, helmet, CORS, shutdown hooks
│   ├── app.module.ts                      # Root module: config, GraphQL, auth, throttler, logging
│   ├── auth/
│   │   ├── auth.module.ts                 # Auth module (global JWT guard)
│   │   ├── jwt-auth.guard.ts              # JWT verification guard
│   │   └── public.decorator.ts            # @Public() decorator to skip auth
│   ├── common/
│   │   ├── correlation-id.middleware.ts    # X-Correlation-ID middleware
│   │   └── gql-throttler.guard.ts         # GraphQL-aware throttler guard
│   ├── config/
│   │   ├── config.types.ts                # GatewayConfig type definitions
│   │   ├── config.validation.ts           # Zod validation schema
│   │   └── configuration.ts               # Typed config factory (registerAs)
│   ├── supergraph/
│   │   └── supergraph.loader.ts           # Loads pre-composed supergraph SDL from disk
│   ├── health/
│   │   ├── health.module.ts               # Terminus + HTTP module
│   │   └── health.controller.ts           # /health and /health/ready endpoints
│   ├── metrics/
│   │   ├── metrics.module.ts              # Prometheus default metrics + interceptor
│   │   ├── metrics.controller.ts          # GET /metrics endpoint
│   │   └── metrics.interceptor.ts         # Request count, latency, error metrics
│   └── tracing/
│       └── tracing.ts                     # OpenTelemetry SDK bootstrap (OTLP)
├── test/
│   ├── jest-e2e.json                      # E2E Jest configuration
│   └── factory/
│       └── create-test-module.ts          # Reusable test module factory
├── .env.example                           # Environment variable template
├── .nvmrc                                 # Node.js version (20)
├── dockerfile                             # Multi-stage Docker build
├── docker-compose.yml                     # Local development environment
├── Makefile                               # Common development commands
├── supergraph.graphql                     # Pre-composed supergraph schema (committed, loaded at startup)
├── supergraph-config.yml                  # Rover composition config (subgraph registry)
├── tsconfig.json                          # TypeScript config (strict mode)
└── package.json                           # Dependencies, scripts, Jest config
```
