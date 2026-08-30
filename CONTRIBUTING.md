# Contributing to LOGOS Web

## Before starting

Read the [architecture](./docs/architecture.md), [roadmap](./docs/roadmap.md), and active [Phase 01 plan](./docs/phase-01.md). Lower-level implementation must not silently weaken those documents.

Keep changes inside the active phase. Do not add future services, credentials, real student information, or speculative abstractions.

## Development workflow

1. Create a short-lived branch from current `main`.
2. Install Node.js `24.20.0` and pnpm `11.24.0`.
3. Install with `pnpm install --frozen-lockfile`.
4. Make one coherent change at a time.
5. Run `pnpm check`.
6. Open a pull request and allow every required check to finish.
7. Squash-merge accepted work with a Conventional Commit title.

Use `type: short imperative description` for commits. Do not force-push shared review branches unless coordination explicitly requires it, and never push directly to `main`.

## Security and privacy

Treat every repository file, issue, pull request, build log, screenshot, and artifact as public. Use synthetic data only. Never add credentials, student information, production exports, sensitive URLs, or deployment bypass values.

Do not follow reproduction commands from untrusted issues or pull requests without reviewing them. External Actions must use immutable full commit SHAs with a readable version comment. New runtime packages require a concrete Phase 01 need, lockfile review, and `pnpm audit --audit-level high`.

Report suspected vulnerabilities privately through the process in [SECURITY.md](./SECURITY.md).
