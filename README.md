<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Constellation Gateway

A NestJS-based Apollo Federation Gateway that composes a supergraph from GraphQL subgraphs via runtime introspection and exposes a unified GraphQL endpoint for clients.

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
2. Create an `.env` from the provided template (see [Environment](#environment)):
```bash
cp .env.example .env
```
```env
SERVICE_PORT=3000
SUBGRAPH="constellation|http://localhost:3001/graphql"
```
3. Run in watch mode:
```bash
npm run dev
```
4. Access:
- GraphQL: `http://localhost:3000/graphql` (Apollo landing page enabled locally)
- Health: `http://localhost:3000/health`

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | NestJS (Express) | 10.x |
| GraphQL | Apollo Gateway (Federation v2) | 2.7.1 |
| Language | TypeScript | 5.1.x |
| Runtime | Node.js | 20 |
| Logging | Winston via nest-winston | 3.13.x / 1.9.x |
| Health checks | @nestjs/terminus | 10.2.x |
| HTTP client | Axios via @nestjs/axios | 1.6.x |
| Testing | Jest + ts-jest + Supertest | 29.x |

### Environment
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SERVICE_PORT` | number | `3000` | Port the gateway listens on |
| `SUBGRAPH` | string | *(required)* | Subgraph definition in `name\|url` format for runtime composition via introspection |

- Example: `SUBGRAPH="constellation|http://localhost:3001/graphql"`
- Only a single subgraph entry is supported at runtime (multi-subgraph support is planned).
- An `.env.example` file is provided as a template.

### Running
- Development (watch mode):
```bash
npm run dev
```
- Debug mode:
```bash
npm run start:debug
```
- Production (after build):
```bash
npm run build && npm run start:prod
```

### Docker
Multi-stage build using `node:20` for compilation and `node:20-alpine` for the production image.

Build and run:
```bash
docker build -t constellation-gateway -f dockerfile .
docker run --rm -p 3000:3000 \
  -e SERVICE_PORT=3000 \
  -e SUBGRAPH="constellation|http://host.docker.internal:3001/graphql" \
  constellation-gateway
```
Notes:
- The container exposes port 3000 and sets `NODE_ENV=production`.
- Use `host.docker.internal` to reach host services from Docker on macOS/Windows.
- The production image runs `node dist/main` directly (no NestJS CLI overhead).

### GraphQL Gateway
- **Driver**: `@apollo/gateway` v2.7.1 via `@nestjs/graphql` + `@nestjs/apollo` (Apollo Gateway driver).
- **Composition**: `IntrospectAndCompose` — the gateway introspects the subgraph at startup and composes the supergraph schema at runtime. No static `supergraph.graphql` file is loaded.
- **Endpoint**: `/graphql`.
- **Client UI**: Apollo Server landing page is enabled for local development; Playground is disabled.
- **Header forwarding**: A custom `RemoteGraphQLDataSource` forwards the following headers from the incoming request context to subgraphs via `willSendRequest`:
  - `userId`
  - `authorization`
  - `permissions`
- **Auth context**: The authentication context builder (`handleAuth`) is currently **commented out** in `src/app.module.ts`. JWT verification (`jsonwebtoken`) is not installed. This must be implemented before deploying to production.

### CORS
CORS is configured in `src/main.ts` with the following settings:
| Setting | Value |
|---------|-------|
| Allowed origin | `http://localhost:3002` |
| Allowed methods | `GET, POST, PUT, PATCH` |
| Allowed headers | `Content-Type, Authorization` |
| Credentials | `true` |

These values are currently hardcoded. Adjust `src/main.ts` if your client origin differs.

### Logging
Winston is integrated globally via `nest-winston` and configured in `src/app.module.ts`:
- **Level**: `debug`
- **Transport**: Console only
- **Format**: NestJS-like output with timestamp, milliseconds elapsed, colors, and pretty-print
- **App label**: `Constellation Gateway`

Usage in services/controllers:
```ts
@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger;
this.logger.log('Some log message');
```

### Healthcheck
- **Route**: `GET /health`
- **Module**: `@nestjs/terminus` with `HttpHealthIndicator`
- **Check**: Pings `https://google.com` as a liveness indicator
- **Source**: `src/health/health.controller.ts` and `src/health/health.module.ts`

### Supergraph composition (Rover)
You can generate a static `supergraph.graphql` file for inspection or tooling using the Rover CLI:
```bash
npm run supergraph
```
This runs:
```bash
npx -p @apollo/rover rover supergraph compose \
  --config ./supergraph-config.yml \
  --output supergraph.graphql
```
The `supergraph-config.yml` defines the subgraph(s) for static composition:
```yml
federation_version: 2
subgraphs:
  constellation:
    routing_url: http://localhost:3001/graphql
    schema:
      subgraph_url: http://localhost:3001/graphql
```
Note: The gateway composes at runtime via `IntrospectAndCompose` and does **not** load the generated `supergraph.graphql` file. The file is `.gitignore`d and intended for offline inspection only.

### Scripts
| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `nest start --watch` | Start in watch mode |
| `start` | `nest start` | Start once |
| `start:prod` | `node dist/main` | Start compiled production app |
| `start:debug` | `nest start --debug --watch` | Start in debug mode with watch |
| `build` | `nest build` | Compile TypeScript to `dist/` |
| `supergraph` | `npx -p @apollo/rover rover supergraph compose ...` | Generate static supergraph schema |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | Lint and auto-fix TypeScript |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | Format code with Prettier |
| `test` | `jest` | Run unit tests |
| `test:watch` | `jest --watch` | Run tests in watch mode |
| `test:cov` | `jest --coverage` | Run tests with coverage |
| `test:debug` | `node --inspect-brk ... jest --runInBand` | Debug Jest tests |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | Run E2E tests (loads `.env`) |

### Testing
```bash
npm run test          # unit tests
npm run test:watch    # unit tests in watch mode
npm run test:cov      # unit tests with coverage report
npm run test:e2e      # e2e tests (loads env via DOTENV_CONFIG_PATH=.env)
```

- **Framework**: Jest 29 with `ts-jest` transformer
- **Unit tests**: `*.spec.ts` files under `src/` (configured in `package.json`)
- **E2E tests**: `*.e2e-spec.ts` files under `test/` (configured in `test/jest-e2e.json`)
- **Test factory**: `test/factory/create-test-module.ts` provides a reusable test module builder with `init()` and `close()` lifecycle methods.

### Code Quality
- **Linting**: ESLint with `@typescript-eslint/recommended` and Prettier integration
- **Formatting**: Prettier (single quotes, trailing commas)
- **TypeScript**: Target ES2021, CommonJS modules, decorator metadata enabled, incremental compilation
- **Build**: NestJS CLI compiles to `dist/`, output directory is cleaned before each build

### Project structure
```
constellation-gateway/
├── src/
│   ├── main.ts                   # Bootstrap, CORS, logger, port binding
│   ├── app.module.ts             # Root module: ConfigModule, GraphQL gateway,
│   │                             #   Winston logging, HealthModule
│   └── health/
│       ├── health.module.ts      # TerminusModule + HttpModule imports
│       └── health.controller.ts  # GET /health endpoint
├── test/
│   ├── jest-e2e.json             # E2E Jest configuration
│   └── factory/
│       └── create-test-module.ts # Reusable test module factory
├── .env.example                  # Environment variable template
├── .nvmrc                        # Node.js version (20)
├── dockerfile                    # Multi-stage Docker build (node:20 → node:20-alpine)
├── nest-cli.json                 # NestJS CLI settings
├── supergraph-config.yml         # Rover composition config (offline use)
├── tsconfig.json                 # TypeScript base config
├── tsconfig.build.json           # TypeScript build config (excludes tests)
├── .eslintrc.js                  # ESLint configuration
├── .prettierrc                   # Prettier configuration
└── package.json                  # Dependencies, scripts, Jest config
```

### Roadmap / TODOs
- Multi-subgraph runtime composition (comma-separated or multi-line env input)
- Request context builder and JWT verification to securely propagate auth headers to subgraphs
- Configurable CORS origins via environment variables
- Configurable log level via environment variable
