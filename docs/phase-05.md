# Phase 05 — Google Workspace Integration Foundation

> - Status: Repository implementation complete; phase blocked on separately approved live smoke tests
> - Project: LOGOS — The Tokyo International School Math Club
> - Repository: `LOGOS-The-TIS-Math-Club/logos-web`
> - Branch: `phase/05-workspace-integration`
> - Date: 2026-09-01
> - Production: Dormant; no production credentials, student data, or public activation authorized

## 1. Objective and expected outcome

Establish narrow, server-only, testable boundaries for the approved Google Workspace behaviors: read Calendar events with explicit freshness and degraded states, read Drive metadata and existing links for allowlisted resources, expose centrally managed Classroom links without the Classroom API, and send later transactional notifications through Gmail using the Phase 03 durable-operation foundation.

The expected outcome is a set of domain-level contracts and controlled adapters that later phases can call without receiving Google SDK types, credentials, raw provider payloads, or provider-specific errors.

## 2. Architecture references and dependencies

This phase follows [architecture.md](./architecture.md), especially the external-content boundary, modular-monolith dependency direction, Workspace and Notifications module responsibilities, source-of-truth table, transactional external-side-effect rule, credential separation, and dormant-production constraint. It implements the Phase 05 summary in [roadmap.md](./roadmap.md).

Dependencies already completed:

- Phase 02 server-only environment validation, Drizzle/PostgreSQL foundation, and isolated test configuration.
- Phase 03 correlation, redaction, sanitized telemetry, append-only audit journals, and durable-operation claim/lease/fenced-transition foundation.
- Phase 04 server-only identity boundary. Live Neon Auth and Google OAuth activation remain deferred and do not block controlled Phase 05 repository tests.

The provider contract follows current first-party Google documentation for Calendar `events.list`, Drive file metadata, Gmail `users.messages.send`, OAuth service accounts, and provider error handling.

## 3. Scope and non-goals

### In scope

- Separate, server-only Calendar, Drive, Gmail, and Classroom-link modules.
- Zod validation for configuration and provider responses.
- Explicit request timeouts and narrow transient-failure classification.
- Calendar event reads with a brief cache, explicit freshness, last-known-good stale fallback, and an unavailable state when no safe cache exists.
- Drive metadata and existing browser links for explicitly allowlisted file/folder IDs only.
- Centrally configured Classroom links with configured, invalid, and unavailable states.
- Gmail `gmail.send` delivery from a committed Phase 03 durable operation, including success, retryable pre-acceptance failure, permanent failure, and ambiguous `delivery-unknown` handling.
- Controlled adapters and synthetic fixtures that require no live credentials.
- Credential, scope, environment, rotation, revocation, smoke-test, and operational documentation.

### Non-goals

- Phase 06 pages, member/leadership dashboards, applications, membership, attendance, absences, warnings, or final notification templates.
- Calendar writes, a Calendar editing UI, or a second writable event store.
- Drive downloads, exports, uploads, binary storage, permission/sharing changes, ownership changes, archives, or backups.
- Classroom API use, credentials, scopes, roster synchronization, or membership automation.
- A new queue, Redis, Apps Script, separate backend, recurring provider, paid API, or LLM dependency.
- Production activation, billing, real student data, Neon Auth repair, or live Google OAuth activation.
- Domain-wide delegation.

## 4. Deliverables and affected interfaces

### Shared provider behavior

- Provider SDK/HTTP shapes terminate at adapter boundaries.
- Domain results contain bounded identifiers, safe display metadata, existing HTTPS links where approved, timestamps, and stable error/status codes only.
- Configuration and provider payloads fail closed when invalid.
- Timeouts are explicit. Retries apply only to failures proven to occur before provider acceptance and classified as transient; validation, authentication, authorization, and permanent failures fail immediately.
- Logs, audit metadata, Sentry data, public errors, tests, and client bundles exclude credentials, tokens, recipient addresses, message bodies, provider payloads, student information, and sensitive URLs.

### Calendar interface

- Input: a bounded event-list request suitable for later public/member reads.
- Output: sanitized events plus `freshness: "fresh" | "stale"`, `fetchedAt`, and an explicit unavailable result when no cache exists.
- Events are expanded and ordered for predictable later consumption, with bounded date range and result count.
- Cache lifetime is brief. A successful refresh replaces the last-known-good value. Provider failure or timeout may return the last safe value as stale; stale data is never labeled current.
- Calendar remains the only writable event authority.

### Drive interface

- Input: a logical configured resource key, never an arbitrary caller-selected Drive ID.
- Output: validated `id`, `name`, `mimeType`, and existing `webViewLink` only.
- The adapter requests an explicit field projection and uses `drive.metadata.readonly`, which does not permit content access.
- No code path performs `alt=media`, export, upload, create, update, delete, permission, or sharing operations.

### Classroom-link interface

- Input: centrally managed server configuration.
- Output: configured safe HTTPS links or an explicit invalid/unavailable state.
- No Google Classroom client, credential, token, or scope is introduced.

### Gmail interface

- Input: a claimed committed durable operation containing only the minimum delivery payload needed by the server-side worker boundary.
- Output/state: `succeeded` with a bounded provider reference, retryable known pre-acceptance failure, terminal permanent failure, or ambiguous `delivery-unknown` mapped to the existing durable-operation ambiguous state.
- The sender is fixed to `mathclub@tokyois.com`; the OAuth grant uses only `https://www.googleapis.com/auth/gmail.send` and is independently revocable.
- No send occurs inside the business transaction or before its delivery intent commits. Ambiguous outcomes are never blindly resent.

## 5. Security, privacy, data, and migration considerations

### Credentials and scopes

- Calendar: service account shared onto the exact non-sensitive test calendar; `https://www.googleapis.com/auth/calendar.events.readonly`.
- Drive: the same or separately revocable service account shared onto exact non-sensitive test resources; `https://www.googleapis.com/auth/drive.metadata.readonly`.
- Gmail: separate user OAuth refresh token for `mathclub@tokyois.com`; `https://www.googleapis.com/auth/gmail.send` only.
- Classroom: no API credential and no scope.
- Domain-wide delegation is prohibited. The service account accesses only resources explicitly shared to its identity.

Production Gmail credentials may exist only in the approved production secret store after later authorization. Development, preview, CI, source control, browser code, transcripts, and fixtures use controlled adapters and never receive the real Gmail token. Non-production Calendar/Drive credentials, if later approved, are independently revocable and limited to non-sensitive test resources.

Rotation replaces a secret in the approved store, deploys/restarts the consuming environment, verifies one separately authorized non-sensitive request, and revokes the superseded key/token. Revocation removes the resource share or OAuth grant and deletes the stored secret. No secret value is retained as evidence.

### Data and migrations

The implementation should first prefer a bounded in-process Calendar cache because Phase 05 does not require cross-instance cache persistence by itself. If repository evidence shows that degraded behavior must survive serverless instance replacement, add a separate additive schema migration for a sanitized last-known-good Calendar cache; no provider payload, attendee, organizer email, description, or credential may be persisted. Any schema and data backfill remain separate, forward-only production migrations.

Gmail reuses `logos.durable_operations`; a schema migration is warranted only if the existing bounded states and payload contract cannot represent the approved delivery outcomes safely. Direct runtime updates/deletes remain prohibited and hardened transitions retain fencing.

## 6. Expected Conventional Commit checkpoints

1. `docs(phase-05): define workspace integration foundation`
2. `feat(workspace): add controlled calendar drive and classroom adapters`
3. `feat(notifications): add durable gmail delivery adapter`
4. `test(phase-05): verify workspace failure boundaries`
5. `docs(phase-05): record implementation and smoke-test gate`

Commits may be combined when the implementation remains reviewable, but each commit must be cohesive and conventional. No unrelated changes are included.

## 7. Verification and acceptance criteria

Focused tests must prove:

- configuration and provider-response validation, server-only imports, bounded errors, timeouts, and transient/permanent classification;
- Calendar cache hit, refresh, timeout, provider failure, explicit stale fallback timestamp, and safe empty-cache unavailable behavior;
- Drive allowlisted-resource metadata, invalid response, permission failure, and the absence of binary/download/export/upload/sharing mutation paths;
- Classroom configured, invalid, and unavailable link states without a Classroom API dependency;
- Gmail success, known pre-acceptance transient failure, bounded retry, permanent failure, ambiguous `delivery-unknown`, and refusal to resend ambiguous work;
- audit, log, public error, and Sentry redaction for credentials, tokens, recipients, bodies, provider payloads, and sensitive links;
- controlled adapters with no live credentials;
- fresh/repeated migration and role-permission behavior if a migration is added.

At delivery, run the established suite once after focused checks: formatting, lint, TypeScript, Vitest, migration synchronization, production build, relevant Playwright, release verification, and established security/dependency checks. Do not repeat a passing full suite unless relevant code changes afterward.

Repository implementation is accepted only when documentation identifies exact configuration variables without secret values, exact scopes, environment placement, rotation/revocation, degraded behavior, and the grouped live-smoke approval request.

## 8. Completion gate

Phase 05 is complete only when all repository implementation and controlled tests pass, one focused security review has no unresolved material finding, and separately approved least-privilege live smoke tests pass once for the exact non-sensitive Calendar and Drive resources and the exact approved Gmail sender/recipient/message. If school policy, administrator access, resource sharing, required scopes, or Gmail authorization is unavailable, Phase 05 remains explicitly blocked; repository completion does not waive the live gate.

## 9. Handoff requirements

The Phase 06 handoff must provide the Calendar event-read contract and freshness semantics, safe Drive/Classroom resource results, controlled adapters for tests, and no provider types or credentials. Later notification phases receive the durable Gmail delivery contract and ambiguous-outcome rule, not a business-specific email template.

Before any live smoke test, request one grouped approval identifying the exact Google Cloud project, service-account/account identity, Calendar ID and test event behavior, Drive file/folder IDs, Gmail sender and non-sensitive recipient, proposed message, exact scopes, secret-store locations, expected provider mutations, cleanup/revocation steps, and confirmation that student data and unrelated resources are excluded. One approved attempt does not authorize retries or broader access.

## 10. Completion evidence

Repository implementation completed on 2026-09-01 without a schema migration or new dependency. It adds:

- server-only Google token, Calendar, Drive metadata, Classroom-link, and Gmail boundaries;
- exact Calendar, Drive, and Gmail scope constants;
- Zod validation for configuration, provider responses, resource metadata, links, and message inputs;
- explicit bounded timeouts and stable failure classification;
- a 60-second in-process Calendar cache with fresh, stale-with-timestamp, and unavailable states;
- logical-key Drive allowlisting, explicit metadata projection, trusted Google link validation, and no binary or mutation method;
- configuration-only Classroom links restricted to trusted HTTPS Classroom hosts;
- production-only Gmail credential validation, controlled adapters, and a Gmail worker that uses Phase 03 fenced durable-operation transitions;
- pre-dispatch lease sufficiency, bounded retry for known pre-acceptance transient failure, terminal permanent failure, and `ambiguous`/`DELIVERY_UNKNOWN` handling without blind resend; and
- synthetic tests for credential/configuration, provider response, cache, timeout/failure, link, read-only, delivery, redaction, and server-only boundaries.

The single focused security review found and corrected three material issues: Gmail CR/LF header injection, untrusted provider-returned link hosts, and missing preview/CI exclusion for service-account credentials. The production dependency audit reports no known vulnerabilities, and the repository scan found no credential material or broader Google scope.

Focused verification passes 28 tests across six Phase 05 test files, plus TypeScript and ESLint. The single established delivery run passed formatting, repository-wide lint and TypeScript, 239 Vitest tests across 31 files, Drizzle migration synchronization, the Next.js production build, all 9 Playwright Chromium checks, Release Please verification, and the production dependency audit. The host used Node 26.7.0 and emitted the expected engine warning because the repository targets Node 24.x; no check failed.

AGY and `gemini-3.7-flash-high` were present, but AGY's headless command permission was auto-denied before implementation began. No blanket permission bypass was enabled, no AGY change occurred, and implementation continued locally as permitted by the execution brief.

No live Google call, credential creation, resource share, OAuth authorization, or email send has occurred. Phase 05 remains blocked on one separately approved smoke-test attempt. The exact Google Cloud project, service-account identity, Calendar ID, Drive IDs, Gmail recipient/message, secret-store targets, and cleanup owner have not been supplied and will not be invented. Evidence must remain synthetic or redacted.

### First-party provider references

- [Calendar `events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Drive file metadata](https://developers.google.com/workspace/drive/api/guides/file-metadata)
- [Gmail `users.messages.send`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)
- [Gmail error and retry guidance](https://developers.google.com/workspace/gmail/api/guides/handle-errors)
- [Google service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account)
