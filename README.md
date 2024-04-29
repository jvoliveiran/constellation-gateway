<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run dev

# production mode
$ npm run start:prod
```

## Running the app with Docker

```bash
# Create docker image
$ docker build -t constellation-gateway .

# Run a container with image created
$ docker run -p 3000:3000 constellation-gateway
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Monitor and Healthcheck

We use @nestjs/terminus in order to provide a health check endpoint that execute following actions:
- Trigger a http request to google;

This endpoint is accessible through route: `/health`

## Logging

Wiston logger replaces NestJS original logger implementation

```typescript
// Injecting loggers via constructor
@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger

// Logging message, which has type any
this.logger.log('Some log message')
```

Docs: https://www.npmjs.com/package/nest-winston

## Graphql Gateway