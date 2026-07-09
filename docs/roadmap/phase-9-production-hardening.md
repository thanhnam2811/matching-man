# Phase 9: Production Hardening & Developer Experience

## Status

- [ ] In progress

## Objective

Bring the platform from "feature-complete" to "production-grade": self-documenting API,
verifiable quality (coverage, load numbers), and operational visibility. Items are
ordered by impact-per-effort — each stage is independently shippable and leaves the
repository in a demonstrably better state.

## Stage 1 — OpenAPI Documentation

Make the public API self-documenting and explorable without reading source.

- [x] Add `@nestjs/swagger` and decorate existing DTOs/controllers
- [x] Serve Swagger UI at `/v1/docs` (disabled or auth-gated in production if needed)
- [x] Export the generated `openapi.json` and link it from `docs/api-spec-v1.md`
- [x] Document auth schemes: project API key (public API) vs session cookie (dashboard)

**Exit criteria:** a newcomer can integrate a game server using only Swagger UI.

## Stage 2 — Test Depth & Coverage Reporting

The domain logic worth testing is the logic that differentiates the project.

- [x] Unit tests for candidate selection and rating-window filtering
- [x] Unit tests for Elo recalculation (win/loss/draw, K-factor edge cases)
- [x] Unit tests for webhook HMAC signing and signature verification
- [x] E2e test for the happy path: enqueue → match → webhook delivered
- [x] E2e test for retry/backoff on a failing webhook endpoint
- [x] Run `test:cov` in CI and publish the coverage summary in the job output

**Exit criteria:** core matchmaking/rating/delivery logic covered; coverage visible in CI.

## Stage 3 — API Protection

- [x] Rate limiting with `@nestjs/throttler` (per API key for public routes, per IP for auth routes)
- [x] Security headers via `helmet`
- [x] Request payload size limits
- [x] Return standard `429` error in the existing error format

**Exit criteria:** brute-force and abuse vectors on public endpoints are bounded.

## Stage 4 — Observability

- [x] Structured JSON logging (pino via `nestjs-pino`) replacing the default logger
- [x] Request ID propagation (accept/generate `x-request-id`, include in logs and error responses)
- [x] Enrich `/health` with DB connectivity and scheduler liveness
- [x] Log slow queries and failed webhook deliveries with enough context to debug

**Exit criteria:** a production incident can be traced from a single request ID.

## Stage 5 — Evaluation Experience

Lower the barrier for anyone assessing the project.

- [x] One-command demo seed: org + project + API key + game mode + queued players
- [ ] Screenshots (or a short GIF) of the dashboard and live demo in the README
- [x] `docs/` quick-start for integrating a game server end-to-end in under 10 minutes

**Exit criteria:** a reviewer sees the system working within minutes of cloning.

## Stage 6 — Performance Baseline (stretch)

- [ ] Load-test the enqueue → match path with k6 or autocannon against a local stack
- [ ] Document throughput/latency results in `docs/performance.md`
- [ ] Use the numbers to justify (or keep deferring) the Redis/BullMQ upgrade in the backlog

**Exit criteria:** documented, reproducible performance numbers replace guesswork.

## Non-Goals

- New product features (advanced matchmaking rules stay in the backlog)
- Redis/BullMQ adoption — only reconsidered after Stage 6 produces evidence
- Kubernetes or multi-node deployment
