# Phase 04 — Identity and Authorization

> - Status: Complete (code and architecture); live OAuth verification deferred pending external Neon Auth provisioning
> - Branch: `phase/04-identity-authorization`
> - Roadmap: [roadmap.md](./roadmap.md)
> - Architecture: [architecture.md](./architecture.md)
> - Predecessor: [phase-03.md](./phase-03.md) (Completed)
> - Successor: `phase-05.md`
> - Last updated: 2026-09-01

## 1. Approved decision

The consolidated design was approved on 2026-09-01. Implementation is complete on the phase branch without enabling Production Auth, creating credentials, using a real school identity, or broadening the phase boundary.

## 2. Objective and boundary

Phase 04 establishes Google sign-in through current Neon Auth, immutable identity association, explicit school-affiliation evidence, secure sessions, default-deny capabilities, audited access elevation/revocation, and synthetic verification.

It does not create membership records, club-title roles, applications, attendance, warnings, Workspace API integrations, real student-data imports, production authentication, public production deployment, Phase 05, or Phase 07 behavior. Authentication is not membership and grants no protected capability by itself.

No LLM API is part of this subsystem. Phase 04 adds no model spend, retry loop, prompt cache, or LLM credential. Provider work stays within existing free/non-billed boundaries.

## 3. Provider and SDK recommendation

Use the auth-only `@neondatabase/auth` package and its Next.js server entry point:

- `createNeonAuth()` from `@neondatabase/auth/next/server`;
- `auth.handler()` for the proxied Auth route;
- `auth.getSession()` in the server-only identity boundary;
- `auth.signIn.social()` and `auth.signOut()` for Google entry/exit;
- middleware only as an optimistic redirect/filter, never as the authorization boundary.

Do not add `@neondatabase/neon-js`: LOGOS already uses Drizzle for data access and does not need the unified Data API client.

As of 2026-09-01, npm exposes no general-availability release of either package; `@neondatabase/auth@0.5.0-beta` is the latest tag and requires Next.js 16 or later, which this repository satisfies. If approved, implementation will pin that exact release, preserve the lockfile, and add compatibility tests. The beta status is an explicit provider risk, not described as stable.

Neon Auth is Better Auth-based. Neon owns and provisions its `neon_auth` schema; application migrations must not alter provider-owned tables. LOGOS-owned identity and access tables live only in `logos`. The Free plan currently includes Neon Auth up to 60,000 monthly active users, and no billing will be enabled.

First-party evidence:

- [Neon Auth v0.2 migration and current Next.js server API](https://neon.com/docs/auth/migrate/from-auth-v0.1)
- [Neon Auth SDK simplification and session cache](https://neon.com/docs/changelog/2026-01-30)
- [Better Auth-based branchable identity and `neon_auth` ownership](https://neon.com/docs/changelog/2025-12-12)
- [Vercel preview Auth isolation](https://neon.com/docs/changelog/2026-01-16)
- [Neon pricing](https://neon.com/pricing)

## 4. Non-production Google configuration

Create one non-production Google OAuth web client and configure it in Neon Auth only for the non-production branch/environment. Request exactly `openid email profile`. Do not request Calendar, Drive, Gmail, Classroom, or other Workspace scopes.

Use exact HTTPS origins and the exact callback URI displayed by the selected Neon Auth branch. Do not use wildcard origins, wildcard redirects, URL-carried credentials, or a Production client. Prefer an Internal consent configuration if Tokyo International School administration permits it; otherwise use External testing mode with explicitly approved synthetic/test users. The OAuth client secret goes directly into Neon/Google configuration and never into source, chat, logs, `NEXT_PUBLIC_*`, or test fixtures.

Google's `hd` request parameter is only an account-chooser hint. Access decisions use the verified returned ID-token claim, not the hint or email suffix.

## 5. Stable identity association

Create a LOGOS application identity keyed by an application UUID with two immutable unique associations:

1. the Neon Auth user ID from the validated server session; and
2. the Google provider account ID/subject (`sub`) associated with that Neon Auth user.

Store the current email only as mutable display/contact data. Require `emailVerified === true` before creating or refreshing an association. Reject provider switching and subject changes for an existing association; do not merge identities by matching email.

The provider adapter may transiently handle a Google ID token on the server solely to verify signature, issuer, audience, expiry, nonce/flow binding, `sub`, `email_verified`, and `hd`. It stores only normalized claim evidence, never the token. Tokens and session artifacts are forbidden from browser storage, application logs, audit metadata, errors, and Sentry.

The current Neon session contract documents the Neon user and verified-email state but does not document signed `hd` as a session field. Implementation must prove a supported server-side path to the signed Google ID token. If Neon Auth does not expose that evidence through a supported boundary, the identity remains `pending_verification`, automatic affiliation is blocked, and the exact provider limitation is documented. Direct email-suffix fallback is prohibited.

Google documents `sub` as stable even when email changes and requires `hd`, not the email domain, for Workspace affiliation:

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google ID-token claims](https://developers.google.com/identity/openid-connect/reference)

## 6. Affiliation model

Affiliation has three states:

- `pending_verification` — default for missing, unknown, unverifiable, or unsupported `hd` evidence;
- `verified` — supported by current evidence;
- `revoked` — previously verified evidence is no longer accepted.

Evidence is append-only and records only normalized facts: evidence type (`google_hd` or later approved manual review), normalized hosted domain where applicable, verification timestamp, verifier application identity where applicable, and a bounded reason code. It stores no raw token, claims blob, IP, or session value.

Only a verified signed Google `hd=tokyois.com` claim automatically creates verified affiliation. No other domain is pre-approved. Missing/unknown domains are not automatically rejected; they remain pending. A later manual transition requires the explicit access-management capability, a bounded reason, and an audit record. Ordinary Google OIDC does not prove Google Workspace 2-Step Verification, so Phase 04 will not claim or enforce it without separate verified Workspace policy evidence.

## 7. Technical access and capabilities

Club titles, membership, and technical access remain separate. An absent or inactive assignment resolves to `none`.

Technical access levels are deliberately generic:

- `basic` — only the explicitly mapped self-service identity capability;
- `operator` — explicitly mapped identity-review operations;
- `access_admin` — explicitly mapped access assignment, revocation, and session-revocation operations.

Levels do not imply capabilities by rank. A server-only resolver maps each level to an explicit compile-time capability set; unknown levels/capabilities deny. Future phases add named capabilities deliberately rather than treating “higher” as universal access.

Every protected Route Handler, Server Function, and data-access method calls one server-only guard close to the data source. The guard validates the session, loads the current LOGOS identity, verifies active affiliation where the requested capability requires it, loads the current non-revoked assignment, resolves the capability, and denies by default. Proxy/UI checks are convenience only.

This follows current [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) and [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## 8. Initial access bootstrap

Use a one-time, transactional, audited bootstrap bound to an already associated, verified, active application identity—not an email address.

The bootstrap operation:

1. accepts the application identity UUID after the intended person has completed Google sign-in;
2. locks a singleton bootstrap state;
3. requires verified email, verified `tokyois.com` affiliation, active identity, no existing active `access_admin`, and an unused bootstrap;
4. creates the first `access_admin` assignment, appends the audit event in the same transaction, and marks bootstrap consumed; and
5. cannot be rerun or reset by the runtime role.

There is no permanent administrator email allowlist. Later access changes require an active `access_admin` and are audited.

## 9. Sessions, CSRF, sign-out, and revocation

Keep Neon Auth cookies host-only by omitting `Domain`, and require `Secure` and `HttpOnly`. Use `SameSite=Lax` because the top-level Google OAuth callback is cross-site; explicit CSRF protection remains mandatory. Configure the signed session-data cache to 60 seconds rather than the five-minute default, limiting stale authentication state while retaining most cache savings.

The existing Phase 03 CSRF token becomes session-bound after authentication: its HMAC covers the random token, expiry, and current Neon session ID. The browser can echo only the opaque anti-CSRF value; it never receives a session identifier. Sign-out and every other unsafe operation require exact trusted origin plus the session-bound double-submit token.

Every protected operation reads current LOGOS identity/affiliation/access state from PostgreSQL. Local deactivation or assignment revocation therefore denies immediately even if Neon's signed session-data cache remains valid. High-risk access mutations additionally bypass the session-data cache for upstream session validation. Deactivation attempts to revoke all provider sessions, but local denial does not depend on that provider call succeeding.

Sign-out calls Neon Auth server-side, clears provider/session-data cookies, clears the session-bound CSRF cookie, and returns a generic signed-out state. Session lookup/network/parse failures fail closed and expose no provider detail. Neon Auth's documented `revokeSession`/`revokeOtherSessions` methods support administrative and user revocation.

Provider session maximum age is not currently documented in the first-party Next.js SDK material. Implementation will record the actual Neon configuration available; it will not invent an unsupported absolute/inactivity lifetime. Local access revocation remains the immediate authorization control.

## 10. Audit and failure behavior

Use existing Phase 03 correlation, redaction, PostgreSQL rate limiting, and append-only journals.

Sanitized security events cover sign-in start/result, invalid/unverified identity, identity association/mismatch, affiliation pending/verified/revoked, session failure/sign-out/revocation, denied capability, rate limit, bootstrap attempt/result, access elevation, and access revocation. Store application identity IDs, normalized reason codes, policy names, and correlation IDs only. Do not store email, `sub`, `hd` claims blobs, tokens, cookies, raw IPs, provider errors, or user-agent strings in audit metadata.

Identity/affiliation/access state changes and their business/security audit records commit atomically. Provider session revocation is a post-commit best-effort effect; failure leaves local access denied and records only a bounded failure code.

Authentication initiation uses the Phase 03 shared `auth_attempt` policy. The subject is an HMAC of a bounded server-derived network identifier; raw addresses are never stored or logged. Permanent validation/provider errors fail immediately and are not retried. Only narrowly classified transient server/network failures may use bounded exponential backoff; retry never bypasses the rate limit.

## 11. PostgreSQL and migration design

Use additive, version-controlled Drizzle migrations for LOGOS-owned objects only:

- `application_identities` with immutable unique Neon user and Google subject associations, mutable display email, active state, and timestamps;
- `affiliation_evidence` as append-only normalized evidence/history;
- `technical_access_assignments` with explicit level, grant/revoke timestamps, grantor/revoker, and reason codes;
- `access_bootstrap_state` as a singleton one-time gate.

Use `text` for provider identifiers/email, `uuid` for LOGOS identities and audit links, `timestamptz` for time, enums/check constraints for states, and B-tree indexes on unique association keys and active assignment lookup. New tables are initially empty, so inline index creation is safe; future indexes on populated tables use separate concurrent migrations.

The runtime role receives only the reads needed for resolution. Raw access-state writes and bootstrap mutation are revoked; narrowly scoped hardened functions or transactional service paths receive the minimum grants. `PUBLIC` execution is revoked, functions use a fixed safe `search_path`, queries remain parameterized, and no down migration runs in deployed environments. Schema and later data backfills remain separate. The backup role retains the required read path.

LOGOS does not treat provider-owned `neon_auth` tables as application migration targets. RLS is not used as a substitute for server authorization while the application connects through a shared runtime role; current identity/capability checks remain explicit at the server data-access boundary.

## 12. Preview and CI isolation

Production remains dormant and unconfigured. Non-production Auth lives only in `logos-web-nonproduction`. Preview branches originate from the schema-only empty preview root, receive their own Auth endpoint/configuration, contain synthetic identities only, remain Vercel-authenticated and `noindex`, and expire with the preview. They must not branch from or inherit any future production identity/session data.

Automated CI uses a provider adapter/test double plus deterministic synthetic Google claim fixtures signed by a test-only key. It never uses Google client credentials, live OAuth tokens, real school identities, or a production Auth endpoint. PostgreSQL 17 integration tests apply migrations fresh and verify grants/functions under unprivileged roles.

## 13. Test gate

Focused and complete checks must cover:

- Google sign-in initiation/callback adapter behavior and sign-out;
- immutable Neon-user/Google-sub association and email changes;
- `email_verified=false`, missing `hd`, unknown `hd`, valid `tokyois.com`, and malformed claim evidence;
- no capability from authentication or affiliation alone;
- explicit synthetic elevation and default-deny resolution;
- one-time bootstrap concurrency and replay denial;
- immediate local deactivation/revocation despite an existing cached session;
- provider session failure and revocation failure;
- session-bound CSRF mismatch/replay, trusted-origin enforcement, and auth rate limiting;
- atomic state/audit writes and audit redaction;
- database constraints, indexes, role grants, fresh/repeated migrations, export/restore, and preview isolation;
- accessible minimal sign-in, sign-out, pending, denied, and session-failure states;
- complete formatting, lint, types, Vitest, PostgreSQL 17, build, Playwright, and security checks.

## 14. Limited hosted-domain smoke test

`mathclub@tokyois.com` is not needed for automated or CI verification. It is useful only for one separately approved, non-production end-to-end smoke test proving that the live Google/Neon boundary actually delivers verifiable `hd=tokyois.com` evidence.

If that test becomes necessary, request approval first. The user signs in interactively; no credential or code is shared. The account receives no lasting `access_admin` authority, and its non-production LOGOS identity, sessions, access assignment, and provider-side test authorization are removed afterward where supported.

## 15. User/provider actions after approval

Implementation can proceed locally without secrets. Live provider completion will require the user or school administrator to:

1. enable Neon Auth on the selected non-production Neon branch/project;
2. create/configure the non-production Google OAuth consent screen and web client;
3. copy the exact Neon-provided callback URI and exact preview/development origins into Google configuration;
4. place the Google client ID/secret and Neon cookie secret directly in Neon/Vercel/ignored local secret stores;
5. confirm the consent mode and approved test users; and
6. optionally perform the separately approved `mathclub@tokyois.com` smoke sign-in.

If school policy blocks any action, Phase 04 records the exact blocker and does not broaden scopes, use personal credentials, enable billing, or invent a workaround.

## 16. Approval gate

Approval authorizes implementation of this design on `phase/04-identity-authorization`. It does not authorize Production Auth, real student data, a live hosted-domain smoke test, billing, Phase 05, or Phase 07.

## 17. Implementation and verification record

The implementation pins `@neondatabase/auth@0.5.0-beta` and `jose@6.2.5`. It mounts the current Neon Auth Next.js handler, keeps cookies host-only with a 60-second signed session-data cache, verifies Google ID-token signature/issuer/audience/expiry server-side, and associates the immutable Google provider subject with the immutable Neon user ID. If the supported token endpoint returns no ID token, the provider account ID is retained as the stable association but affiliation stays `pending_verification`; email suffixes never elevate it.

LOGOS-owned PostgreSQL objects are additive and isolated to `logos`. Runtime callers cannot write raw identity/access tables or invoke the bootstrap. Hardened functions provide association, current access resolution, elevation, revocation, and deactivation. The one-time bootstrap remains migration-owner-only and requires an existing atomic audit record. Every protected capability resolver checks the current active identity, affiliation, and non-revoked assignment; authentication alone grants nothing. Deactivation commits local denial first and then makes a best-effort Neon `revokeUserSessions` call; a provider/API failure is recorded with a bounded code and cannot restore local access.

Synthetic verification covers normalized/malformed Google evidence, missing hosted domain, explicit non-hierarchical capability mapping, session-bound CSRF mismatch/replay, raw-table denial, immutable association mismatch, pending-affiliation denial, one-time bootstrap replay, immediate revocation, backup visibility, fresh/repeated PostgreSQL 17 migrations, export/restore, formatting, lint, type checking, unit/component tests, production build, and browser smoke tests.

Live Google sign-in remains intentionally blocked on external non-production configuration: Neon Auth must be enabled for the selected non-production branch, its exact callback URI must be registered on an approved Google OAuth web client, and the three server-only environment values documented in `.env.example` must be placed in local/Vercel secret stores. No live `mathclub@tokyois.com` smoke test has been authorized or performed.

The exact pinned beta currently brings an unused Auth UI dependency with an upstream Better Auth peer-version mismatch. LOGOS imports only the auth-only server entry point, the frozen install and build pass, and the production dependency audit reports no known vulnerabilities. This is retained as a provider-beta upgrade risk rather than overridden locally.

After the intended administrator has a verified application identity, the migration owner can run the guarded `db:access:bootstrap` operation with `BOOTSTRAP_IDENTITY_ID` set to that UUID and `CONFIRM_PHASE04_BOOTSTRAP=bootstrap-once`. The operation refuses Production, never accepts an email address, writes its audit event and assignment atomically, and cannot be replayed.

## 18. Independent security review and beta dependency decision

On 2026-09-01, an independent read-only review ran through AGY using Gemini 3.7 Flash High against `main...phase/04-identity-authorization`. Its prompt excluded environment variables, credentials, browser sessions, account data, and screenshots. The review found no Critical, High, or Medium issue. It recorded one Low provider-packaging risk: the pinned Auth beta depends on an unused Auth UI package whose downstream Better Auth peer declarations do not align with the server package's pinned Better Auth version. It also recorded the missing-ID-token behavior as informational because that path deliberately retains immutable provider association while leaving affiliation pending.

The dependency decision was rechecked during final review:

- Neon's current first-party SDK repository and January 2026 Next.js guidance still prescribe `createNeonAuth()` from `@neondatabase/auth/next/server` for the server handler and session methods.
- Both the current npm `latest` tag and the first-party repository package manifest are `0.5.0-beta`; npm publishes no stable version to assess or adopt.
- The package's own server-toolkit documentation labels the surface beta and recommends exact pinning.
- A clean production build contains no executable `@neondatabase/auth-ui`, `@daveyplate/better-auth-ui`, or `@better-auth/api-key` code in `.next/static`, `.next/server/app`, or executable `.next/server/chunks`. Source maps contain only the server SDK's documentation comment mentioning Auth UI routes. LOGOS imports only the server entry point and its custom client controls import no Neon package.
- Frozen installation, type checking, production build, supply-chain checks, and the production dependency audit pass. No local peer override is applied because overriding the provider's tested Better Auth graph would create a larger compatibility risk.

The beta remains accepted for non-production Phase 04 with an exact version and lockfile. Upgrade assessment is required when Neon publishes a compatible stable release.

## 19. Redacted provider activation evidence

Provider evidence records only environment names, branch names, bounded outcomes, and reason codes. It excludes client IDs, secrets, Auth endpoints, callback tokens, raw claims, emails, cookies, screenshots, and provider error payloads.

- Target: Neon project `logos-web-nonproduction`, branch `development`; Production Auth remains untouched and disabled.
- Initial Neon result: Auth provisioning was blocked because an existing `neon_auth` schema was present. Immediately before the separately approved deletion, the console target was re-confirmed as project `logos-web-nonproduction` (`dawn-bread-51529312`), branch `development` (`br-wispy-butterfly-azq8pls0`). A redacted, count-only catalog inventory found zero relations (therefore no identity, session, or configuration tables), functions, types, constraints, policies, triggers, operators, collations, conversions, text-search objects, default ACL entries, or schema ACL entries. No object names, row values, identities, provider configuration, endpoints, or credentials were recorded.
- Approved schema repair result: the console executed exactly `DROP SCHEMA neon_auth;` on that target, without `CASCADE`; PostgreSQL reported success and no dependency error. A same-branch verification found `neon_auth` absent while the unrelated `logos` and `public` schemas remained present. No production project or other branch was selected or mutated.
- External provisioning blocker: the supported console enable action recreated the `neon_auth` namespace but returned a bounded internal failure. A count-only check confirmed that the namespace contains zero relations, functions, and types. LOGOS migrations and runtime access only LOGOS-owned objects, so this empty namespace does not affect application migration, schema integrity, or automated operation. It does prevent live provider sessions; Google OAuth configuration and live OAuth verification are deferred until Neon Auth provisioning works.
