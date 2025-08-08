<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Constellation Gateway

A NestJS-based Apollo Federation Gateway that composes a supergraph from one or more GraphQL subgraphs and exposes a single GraphQL endpoint for clients.

### Requirements
- Node.js 20 (`.nvmrc` provided)
- npm 9+
- Optional: Docker 24+
- Optional: Rover CLI for supergraph composition (`@apollo/rover` is available via `npx`)

### Quick start
1. Install dependencies:
```bash
npm install
```
2. Create an `.env` (see Environment):
```env
SERVICE_PORT=3000
# Format: <subgraph-name>|<subgraph-url>
SUBGRAPH="constellation|http://localhost:3001/graphql"
```
3. Run in watch mode:
```bash
npm run dev
```
4. Access:
- GraphQL: `http://localhost:3000/graphql` (Apollo landing page enabled locally)
- Health: `http://localhost:3000/health`

### Environment
- `SERVICE_PORT` (number): Port to listen on. Default: 3000.
- `SUBGRAPH` (string): Subgraph definition in the format `name|url` used for runtime composition via introspection.
  - Example: `SUBGRAPH="constellation|http://localhost:3001/graphql"`
  - Note: Multiple subgraphs are planned (TODO). For now, a single entry is supported at runtime.

### Running
- Development:
```bash
npm run dev
```
- Production (after build):
```bash
npm run build && npm run start:prod
```

### Docker
Build and run:
```bash
docker build -t constellation-gateway .
docker run --rm -p 3000:3000 \
  -e SERVICE_PORT=3000 \
  -e SUBGRAPH="constellation|http://host.docker.internal:3001/graphql" \
  constellation-gateway
```
Notes:
- The container exposes port 3000.
- Use `host.docker.internal` to reach host services from Docker on macOS/Windows.

### GraphQL Gateway
- Driver: `@apollo/gateway` via Nest `GraphQLModule` (Apollo Gateway driver).
- Composition: `IntrospectAndCompose` against the subgraph specified by `SUBGRAPH`.
- Endpoint: `/graphql`.
- Client UI: Apollo landing page is enabled locally; Playground is disabled.
- Header forwarding: The gateway’s `RemoteGraphQLDataSource` forwards `userId`, `authorization`, and `permissions` from the request context to subgraphs.
  - Auth context creation is currently commented/TODO. Add your context builder to propagate values securely.

### CORS
CORS is enabled for `http://localhost:3002` with `GET, POST, PUT, PATCH` and credentials. Adjust in `src/main.ts` if your client origin differs.

### Logging
Winston via `nest-winston` is configured at level `debug` and logs to console with a Nest-like format. You can inject and use the logger in your services/controllers:
```ts
@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger;
this.logger.log('Some log message');
```

### Healthcheck
- Route: `GET /health`
- Implementation: `@nestjs/terminus` with an `HttpHealthIndicator` ping to `https://google.com`.

### Supergraph composition (Rover)
You can generate a static `supergraph.graphql` for inspection or tooling:
```bash
npx -p @apollo/rover rover supergraph compose \
  --config ./supergraph-config.yml \
  --output supergraph.graphql
```
`supergraph-config.yml` example:
```yml
federation_version: 2
subgraphs:
  constellation:
    routing_url: http://localhost:3001/graphql
    schema:
      subgraph_url: http://localhost:3001/graphql
```
Note: The gateway currently composes at runtime via introspection and does not load the generated file.

### Scripts
- `dev`: Start in watch mode
- `start`: Start once
- `start:prod`: Start compiled app
- `build`: Compile TypeScript
- `supergraph`: Compose a supergraph via Rover
- `lint`, `format`: Code quality tools
- `test`, `test:watch`, `test:cov`, `test:e2e`: Testing

### Testing
```bash
npm run test        # unit tests
npm run test:e2e    # e2e tests
npm run test:cov    # coverage
```
`test:e2e` loads env via `DOTENV_CONFIG_PATH=.env`.

### Project structure
```
src/
  main.ts                 # Bootstrap, CORS, logger, port
  app.module.ts           # Config, GraphQL gateway, logging, health module
  health/
    health.module.ts
    health.controller.ts  # GET /health
supergraph-config.yml     # Rover composition config
Dockerfile                # Multi-stage build (Node 20)
```

### Roadmap / TODOs
- Multi-subgraph runtime composition (comma-separated env input)
- Request context and JWT verification to securely propagate headers to subgraphs
