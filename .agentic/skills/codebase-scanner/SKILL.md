---
name: codebase-scanner
description: How to search files through this codebase in case you need to understand or look for some information
---

# Codebase Scanner

## How to operate

When exploring a codebase to implement something:

1. **Start with Glob/Grep, NOT Read.** Use `Glob("src/**/*.spec.ts")` to find test files, `Grep` to search for patterns. Only Read files you've confirmed are relevant.
2. **MAXIMUM 10 tool calls** before producing actionable output (code, a file list, or a concrete gap analysis). If you hit 10 tool calls without output, **STOP exploring and produce output with what you have**.
3. **Never read more than 3 files** for "orientation" — use the project structure map below instead.

## Project Structure

```
src/
├── main.ts                              → App entrypoint
├── app.module.ts                        → Root NestJS module (imports all feature modules)
├── schema.gql                           → Auto-generated GraphQL schema
│
├── auth/                                → Authentication module
│   ├── auth.module.ts                   → Module definition
│   ├── auth.resolver.ts                 → GraphQL mutations: login, refreshToken, requestPasswordReset, resetPassword, forcePasswordReset, verifyEmail, resendVerificationEmail
│   ├── auth.service.ts                  → Core auth logic (login, token refresh, password reset)
│   ├── email-verification.service.ts    → Email verification logic
│   ├── email-verification.repository.ts → Prisma repo for email verification tokens
│   ├── password-reset.service.ts        → Password reset logic
│   ├── password-reset.repository.ts     → Prisma repo for password reset tokens
│   ├── refresh-token.repository.ts      → Prisma repo for refresh tokens
│   ├── dto/                             → Input/Result DTOs (Zod-validated)
│   └── types/                           → TypeScript type definitions (jwt-payload, login-data, etc.)
│
├── users/                               → Users module
│   ├── users.module.ts                  → Module definition
│   ├── users.resolver.ts               → GraphQL mutations/queries: signup, listUsers, userDetail, updateUser, updateMyProfile, assignRole, removeRole
│   ├── users.service.ts                → User business logic
│   ├── users.repository.ts             → Prisma repo for users
│   ├── dto/                             → Input/Result DTOs (signup, update-user, assign-role, etc.)
│   ├── types/                           → TypeScript types (user, user-with-roles, create-user-data, etc.)
│   ├── mappers/                         → prisma-user.mapper.ts (Prisma → domain)
│   └── exceptions/                      → email-already-taken.exception.ts
│
├── rbac/                                → Role-Based Access Control module
│   ├── rbac.module.ts                   → Module definition
│   ├── rbac.resolver.ts                → GraphQL mutations/queries: createRole, updateRole, createPermission, listRoles, roleDetail
│   ├── rbac.service.ts                 → RBAC business logic
│   ├── rbac.repository.ts              → Prisma repo for roles/permissions
│   ├── dto/                             → Input/Result DTOs (create-role, update-role, create-permission, list-roles-filter, role-detail)
│   ├── types/                           → TypeScript types (role, permission, role-permission, user-role-assignment, list-roles-result)
│   ├── mappers/                         → prisma-role.mapper, prisma-role-detail.mapper, prisma-permission.mapper
│   ├── guards/                          → permissions.guard.ts (enforces @RequirePermissions)
│   ├── decorators/                      → require-permissions.decorator.ts
│   └── enums/                           → permission-action.enum.ts
│
├── email/                               → Email module (AWS SES via BullMQ)
│   ├── email.module.ts                  → Module definition
│   ├── email.service.ts                → Enqueues emails to BullMQ
│   ├── email.processor.ts              → BullMQ processor that sends via AWS SES
│   ├── email.constants.ts              → Queue names, constants
│   └── types/                           → send-email-job.types.ts
│
├── common/                              → Shared utilities (no business logic)
│   ├── common.module.ts                 → Module definition
│   ├── dto/                             → paginated-response.factory.ts, pagination.args.ts
│   ├── filters/                         → global-exception.filter.ts
│   ├── guards/                          → gql-throttler.guard.ts
│   ├── middleware/                       → correlation-id.middleware.ts
│   ├── utils/                           → mask-email.ts
│   └── validators/                      → match.validator.ts
│
├── graphql/                             → GraphQL infrastructure (no business logic)
│   ├── formatError.ts                   → Error formatting
│   ├── types.ts                         → GraphQL context types
│   ├── decorators/                      → current-user.decorator.ts, public.decorator.ts
│   ├── directives/                      → access-control.directive.ts, schema-extension.ts
│   └── guards/                          → jwt-auth.guard.ts (global JWT guard)
│
├── prisma/                              → Prisma service wrapper
│   ├── prisma.module.ts                 → Module definition
│   ├── prisma.service.ts               → PrismaClient lifecycle management
│   └── prisma-error-codes.ts           → Prisma error code constants
│
├── config/                              → App configuration
│   ├── configuration.ts                → ConfigModule factory
│   └── config.validation.ts            → Zod schema for env validation
│
├── health/                              → Health check endpoint (REST)
│   ├── health.module.ts                 → Module definition
│   ├── health.controller.ts            → GET /health
│   └── redis-health.indicator.ts       → Redis health check
│
├── monitoring/                          → Observability
│   ├── tracer.ts                        → OpenTelemetry tracer setup
│   └── winston.transporter.ts          → Winston logger transport
│
└── types/                               → Global type declarations
    └── graphql-depth-limit.d.ts

prisma/
├── schema.prisma                        → Database schema (source of truth for all models)
├── seed.ts                              → Database seeder (roles, permissions)
├── seed.spec.ts                         → Seeder tests
└── migrations/                          → Prisma migration files

test/                                    → Integration/E2E tests
├── factory/
│   └── create-test-module.ts            → Shared NestJS test module factory
├── jest-e2e.json                        → E2E Jest config
└── setup-e2e.ts                         → E2E setup file
```

### File Naming Conventions

| Pattern | Purpose | Example |
|---|---|---|
| `*.module.ts` | NestJS module definition | `auth.module.ts` |
| `*.resolver.ts` | GraphQL resolver (queries + mutations) | `auth.resolver.ts` |
| `*.service.ts` | Business logic layer | `auth.service.ts` |
| `*.repository.ts` | Prisma data access layer | `users.repository.ts` |
| `dto/*.input.ts` | GraphQL input types (Zod-validated) | `login.input.ts` |
| `dto/*.result.ts` | GraphQL result/response types | `login.result.ts` |
| `types/*.types.ts` | Internal TypeScript type definitions | `jwt-payload.types.ts` |
| `mappers/*.mapper.ts` | Prisma-to-domain model mappers | `prisma-user.mapper.ts` |
| `*.spec.ts` | Unit test (co-located next to source) | `auth.service.spec.ts` |

### Finding Tests

To discover existing tests, use these patterns — do NOT read files to find them:
- All unit tests: `Glob("src/**/*.spec.ts")`
- All integration tests: `Glob("test/**/*.spec.ts")`
- Tests for a specific module: `Glob("src/modules/<module>/**/*.spec.ts")`
- Source files without tests: compare `Glob("src/**/*.ts")` against `Glob("src/**/*.spec.ts")`

## Schema definition

Core schema definition is defined by `prisma/schema.prisma` file. Use it for better domain understanding

## Usefull documents

README.md (`README.md`) file has a global overview about this project.
Plans about how this project is evolving are stored in `.agentic/plans` folder. Use file names to find something that might be relevant to yours investigation

## Code Review

When reviewing code, **ALWAYS** use `git diff` command to check user unstaged changes