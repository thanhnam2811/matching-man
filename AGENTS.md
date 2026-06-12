# AGENTS.md

Project-level instructions for coding agents working in this repository.

## Status

- This repository is an early-stage product scaffold for a multi-tenant matchmaking platform.
- The approved backend stack is `NestJS + Prisma + PostgreSQL`.
- The current package manager in `apps/api` is `pnpm`.
- The current application structure starts with `apps/api` for the NestJS service.

## First-Step Workflow

- Start every task by inspecting the current tree and git status.
- Treat existing files as the source of truth over prior assumptions.
- If the repo is still effectively empty, prefer proposing or creating the smallest viable scaffold that satisfies the user request.
- Before introducing a new stack or major dependency, state the choice and why it fits the request.

## Current Commands

- API install: `pnpm install`
- API dev: `pnpm start:dev`
- API build: `pnpm build`
- API test: `pnpm test`
- API lint: `pnpm lint`
- API format: `pnpm format`
- Prisma generate: `pnpm prisma:generate`
- Prisma migrate (dev): `pnpm prisma:migrate:dev`
- Prisma Studio: `pnpm prisma:studio`

Run commands from [apps/api](D:/Documents/matching-man/apps/api).

## Decision Rules

- Keep one canonical implementation path. Avoid adding parallel frameworks, duplicate configs, or multiple package managers.
- Prefer boring, maintainable defaults over clever setup.
- Minimize dependency count unless a dependency clearly saves substantial effort or risk.
- Preserve user changes. Never overwrite or delete work you did not create unless explicitly asked.

## Editing Rules

- Make focused changes tied to the requested task.
- Keep files small and names obvious.
- Use ASCII unless the file already requires Unicode.
- Add comments only when the intent would otherwise be hard to infer.
- Do not leave placeholder code, fake TODO implementations, or dead scaffolding without marking it clearly.

## Validation

- After code changes, run the smallest relevant validation available.
- If tests or linters do not exist yet, say so explicitly instead of inventing checks.
- When adding a new toolchain, also add the minimum commands needed to verify it locally.

## Git Hygiene

- Do not revert unrelated user changes.
- Avoid destructive commands such as hard resets or broad deletes unless explicitly requested.
- Keep changes easy to review and logically grouped.

## Documentation

- When the project gains a concrete stack, update this file with:
  - setup commands
  - dev and test commands
  - repo structure
  - code style constraints
  - deployment or environment notes
- If a tool-specific file is needed later, keep `AGENTS.md` as the canonical source and make the other file a thin pointer.

## Repo Structure

- `apps/api`: NestJS API service
- `docs`: product, architecture, API, and roadmap documents

## Empty-Repo Behavior

- If asked to bootstrap the project, create only what is required for the requested outcome.
- If the request is ambiguous and the repo has no code, prefer a minimal foundation plus a short note about the chosen direction.
- Do not fabricate product requirements, hidden APIs, or nonexistent infrastructure.
