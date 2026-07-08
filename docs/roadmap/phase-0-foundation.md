# Phase 0: Foundation

## Status

- [x] Done

## Objective

Create the repository baseline and engineering conventions.

## Implementation Checklist

- [x] NestJS API scaffold
- [x] Prisma setup with PostgreSQL connection
- [x] Environment configuration strategy
- [x] Health endpoint
- [x] Error format standard
- [x] Request validation baseline
- [x] Structured logging baseline

## NestJS Modules

- [x] `app`
- [x] `health`
- [x] `prisma`

Note: there is no dedicated `config` module — environment validation lives in
`apps/api/src/config/env.validation.ts` and is wired directly into
`ConfigModule.forRoot({ validate: validateEnv })` in `app.module.ts`.

## Database Work

- [x] Initialize Prisma schema
- [x] Configure migration workflow
- [x] Define shared columns and naming conventions

## API Endpoints

- [x] `GET /health`

## Internal Services

- [x] `PrismaService`
- [x] `HealthService`

## Done Checklist

- [x] App builds successfully with `pnpm --dir apps/api build` (there is no root `pnpm build` script)
- [x] Database connects successfully
- [x] Migration workflow exists in source (`prisma/migrations`)
- [x] `/health` returns healthy state against a running database

## Notes

- `GlobalExceptionFilter` delivers a consistent error envelope: `{ success, error: { statusCode, code, message, details? }, timestamp, path }`.
- `RequestLoggingInterceptor` emits structured JSON per request: `{ event, method, path, statusCode, durationMs }`.
- `PrismaService.isHealthy()` runs `SELECT 1` and is wired into `/health`.
