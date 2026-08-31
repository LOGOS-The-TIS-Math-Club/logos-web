# Phase 02 — Data Foundation

> - Status: Completed
> - Roadmap: [roadmap.md](./roadmap.md)
> - Architecture: [architecture.md](./architecture.md)
> - Predecessor: [phase-01.md](./phase-01.md)
> - Successor: `phase-03.md`
> - Implementation merge: [`6e14e8b`](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/commit/6e14e8b516555bd1199d86a4e70bc387f6dd5e08) ([pull request #9](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/pull/9))
> - Last updated: 2026-08-31

## 1. Objective

Establish a reproducible, secure, zero-cost PostgreSQL foundation for LOGOS Web. A fresh database must be created deterministically from committed Drizzle migrations, application runtime credentials must be unable to change the schema, and development, preview, CI/test, and dormant production data must remain isolated.

This phase establishes infrastructure only. All records used for verification are deterministic and obviously synthetic.

## 2. Scope

Phase 02 owns:

- two isolated Neon PostgreSQL projects in Singapore;
- Drizzle ORM, Drizzle Kit, and the Neon serverless driver;
- lazy, server-only database construction and Zod environment validation;
- committed SQL migrations and Drizzle metadata;
- migration, runtime, read-only backup, and future audit role boundaries;
- schema-only preview isolation rooted only in non-production;
- deterministic non-production technical fixtures;
- isolated PostgreSQL CI migration, permission, and fixture checks;
- a synthetic `pg_dump`/`pg_restore` rehearsal; and
- the minimum developer documentation and command surface.

## 3. Explicit exclusions

Phase 02 does not implement authentication, authorization, membership applications, members, attendance, absences, sessions, warnings, audit events, outbox records, rate limiting, Sentry, Google Workspace integration, production data migration, production backup automation, public production delivery, or any other domain feature.

No placeholder domain tables are permitted. Membership authority and data-cutover policy remain unresolved for a later phase.

## 4. Established constraints

- GitHub Free, Vercel Hobby, and Neon Free are the only hosted services.
- No billing, payment card, paid feature, or paid capacity may be enabled.
- Node.js `24.20.0`, pnpm `11.24.0`, Next.js `16.3.3`, React `19.2.8`, and TypeScript `5.9.3` remain pinned.
- The root-level Next.js App Router modular monolith remains the application shape.
- PostgreSQL and dynamic Vercel execution remain in Singapore.
- Production remains dormant as `production-disabled-until-phase-11`, empty, and disconnected from development, previews, CI, and pull requests.
- `tislogos.org` must not become publicly live.
- The public `/health` response remains non-sensitive and does not probe PostgreSQL.
- Database URLs are server-only secrets and never use a `NEXT_PUBLIC_*` name.
- Protected environments use migrations; `drizzle-kit push` is not part of the project command surface.

## 5. Current provider facts

Facts were rechecked against first-party documentation on 2026-08-31:

- [Neon pricing](https://neon.com/pricing) describes Free as `$0`, with no time limit or payment card requirement. It currently includes enough projects and branches for this topology, scale-to-zero compute, and a limited restore window.
- [Neon status documentation](https://neon.com/docs/introduction/status) lists AWS Asia Pacific (Singapore), and Neon identifies the project region as `aws-ap-southeast-1` with an `ap-southeast-1.aws.neon.tech` proxy host.
- [Neon compatibility](https://neon.com/docs/reference/compatibility) supports PostgreSQL 14 through 18. Phase 02 selects PostgreSQL 17, a mature supported major rather than a newly introduced major.
- [Schema-only branches](https://neon.com/docs/guides/branching-schema-only) and the [February 2025 CLI update](https://neon.com/docs/changelog/2025-02-07) support branches without parent data, `NOLOGIN` roles, branch expiration, and cleanup.
- Ordinary Neon branches copy their parent's schema and data using copy-on-write. The standard preview integration is therefore unsafe when its parent can ever contain production data.
- [Neon role documentation](https://neon.com/docs/manage/roles) distinguishes Console/API-created login roles, which receive `neon_superuser` membership, from SQL-created roles, which do not. Runtime and backup logins must be created through SQL and receive explicit grants only.
- [Drizzle's Neon driver documentation](https://orm.drizzle.team/docs/connect-neon) states that HTTP is optimized for single non-interactive operations, while the WebSocket `neon-serverless` driver supports sessions and interactive transactions through `Pool` or `Client`.
- The first-party [`@neondatabase/serverless` documentation](https://github.com/neondatabase/serverless#sessions-transactions-and-node-postgres-compatibility) explicitly supports Vercel serverless environments. It requires each WebSocket `Pool` or `Client` to be created, used, and closed within one request because the connection cannot outlive that request. It also states that only Node.js 21 and earlier require a supplied WebSocket constructor; the pinned Node.js 24 runtime provides the required global.
- [Drizzle's transaction documentation](https://orm.drizzle.team/docs/transactions) confirms that its callback transaction API commits a multi-statement unit atomically, rolls the unit back on failure, and supports PostgreSQL transaction configuration. This is the required behavior for later business-mutation, audit, and outbox writes.
- Stable compatible releases selected on 2026-08-31 are `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `@neondatabase/serverless@1.1.0`, and `zod@4.5.4`.

Numeric provider allowances are observations, not architectural invariants. They must be rechecked before creating resources or changing automation.

## 6. Implemented database topology

| Environment       | Neon resource                                                       | Data policy                                                   | Credential policy                                                                              |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Future production | `logos-web-production` project, PostgreSQL 17, `aws-ap-southeast-1` | Empty and dormant through Phase 10                            | Production-only migration/runtime/backup logins; never supplied to CI, previews, or developers |
| Development       | `logos-web-nonproduction` project, long-lived development branch    | Deterministic synthetic fixtures only                         | Non-production login roles only                                                                |
| Preview           | Expiring schema-only branch from an empty non-production baseline   | Full migrations plus deterministic synthetic fixtures         | Unique or independently revocable preview credentials                                          |
| CI/test           | GitHub Actions PostgreSQL 17 service container                      | Fresh empty database per run; deterministic synthetic fixture | CI-local credentials only; no Neon secret                                                      |

Two projects create a provider-level isolation boundary. No branch in the non-production project can descend from or enumerate a branch in the production project.

Both projects were created only after the account was confirmed to be on Neon Free and the Singapore region was explicitly selected. The production project contains no application tables, retains only its provider owner login, and has no Vercel environment variable or preview connection.

## 7. Driver and migration strategy

### Runtime driver

The application uses Drizzle's `neon-serverless` WebSocket path through `@neondatabase/serverless`. A single driver avoids divergent transaction behavior. This choice adds no external service, is documented for Vercel serverless execution, and supports the later requirement that a business mutation, audit event, and outbox intent commit atomically in one interactive Drizzle transaction.

Database construction is lazy and operation-scoped. Static builds and non-database tooling do not require a URL. A server-only `withDatabase` boundary validates the environment, creates a short-lived Neon `Pool` and Drizzle client, runs one callback, and closes the pool in `finally` before the request or operation ends. There is no reusable global WebSocket pool and no browser-capable singleton.

### Migration workflow

- Drizzle schema declarations are the generation source.
- `drizzle-kit generate` creates reviewable SQL and metadata under `drizzle/`.
- An explicit migration script applies committed migrations using `MIGRATION_DATABASE_URL`.
- The Next.js application never migrates on startup or build.
- `drizzle-kit push` is prohibited for development, preview, and production.
- CI regenerates into a temporary directory or compares generation state so uncommitted schema changes fail.
- CI applies migrations to a fresh PostgreSQL 17 database and applies them again to verify the documented idempotent no-op behavior of the migration runner.
- Deployed migrations are immutable. Production recovery uses a forward-fix migration or a tested restore; it does not edit migration history or run an improvised down migration.

The initial migration creates only a dedicated technical schema and a small infrastructure probe table. The table exists solely to verify DML grants, read-only behavior, deterministic fixtures, and export/restore before domain tables exist. It is not a generic CRUD or domain model and contains no personal information.

## 8. Environment and secret boundaries

| Variable                 | Purpose                                    | Local development                         | Vercel Preview                    | CI/test                    | Dormant production                                       |
| ------------------------ | ------------------------------------------ | ----------------------------------------- | --------------------------------- | -------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`           | Pooled runtime login                       | Non-production only                       | Schema-only preview only          | CI runtime login           | Production runtime only after a later activation gate    |
| `MIGRATION_DATABASE_URL` | Direct migration login                     | Non-production only                       | Controlled preview migration step | CI migration login         | Stored but unused until an approved production migration |
| `TEST_DATABASE_URL`      | Isolated database-test owner/migration URL | Local disposable PostgreSQL only          | Never                             | CI PostgreSQL service only | Never                                                    |
| `BACKUP_DATABASE_URL`    | Read-only export login                     | Optional non-production restore rehearsal | Never                             | CI backup login            | Production-only in Phase 10                              |
| `APP_ENV`                | Explicit environment safety label          | `development`                             | `preview`                         | `test`                     | `production`                                             |

`.env.example` contains non-routable placeholders only. Real values belong in ignored `.env.local`, Vercel encrypted environment variables, Neon-managed credential storage, or GitHub encrypted secrets where unavoidable. No CI job for untrusted pull-request code receives a Neon secret.

Environment parsing:

- uses Zod at the first database operation;
- requires `postgresql:` or `postgres:` URLs with TLS enabled for Neon environments;
- emits clear variable-name errors without echoing values or full connection failures;
- refuses synthetic fixture loading when `APP_ENV=production`;
- requires the owner-controlled database identity comment (`logos.app_environment=<environment>`) to equal `APP_ENV` before migrations, fixtures, permission tests, or restore rehearsals; and
- verifies both the URL database name and that independent owner-controlled comment rather than treating Neon's common `neondb` name as project identity.

The database identity comment is established by the controlled provider/bootstrap procedure before the first migration. Only the database owner can change it; runtime and backup roles cannot spoof it with a session setting. CI uses `db:test:configure`, which is hard-limited to `APP_ENV=test` and a local hostname; it cannot configure a hosted database.

## 9. Role and permission model

Four `NOLOGIN` group roles define policy:

- `logos_migration`: marks the controlled migration/bootstrap policy and receives database access; the environment's provider-managed migration login owns application objects and is its only member;
- `logos_runtime`: receives schema usage plus explicitly approved `SELECT`, `INSERT`, `UPDATE`, and `DELETE` grants on application tables, with matching default privileges for future migration-owned objects;
- `logos_backup`: receives connect, schema usage, and `SELECT` only; and
- `logos_audit`: reserved with no Phase 02 table privileges. Phase 03 will define append-only audit permissions.

Credential-bearing environment logins are never created by a committed migration. They are created through secure Neon controls or an out-of-band administrative procedure, then assigned only the required `NOLOGIN` group role. Runtime and backup logins must not receive `neon_superuser`; the provider-generated owner login is retained as the controlled migration/bootstrap credential. Generated passwords and connection URLs are stored only in approved provider secret stores and never in source, migration SQL, terminal output, or documentation.

Automated tests must prove:

1. the migration credential applies the approved migration;
2. runtime can read and write the infrastructure probe;
3. runtime cannot create, alter, or drop schemas/tables;
4. backup can read but cannot insert, update, delete, or execute DDL; and
5. real runtime and backup login sessions cannot regain an owner identity with `RESET ROLE`; and
6. a non-production/test connection contains only the synthetic marker and carries matching database-side environment evidence rather than production identity.

## 10. Preview isolation strategy

Preview branches may be created only as schema-only branches in `logos-web-nonproduction`. Their parent is a deliberately empty `preview-root-empty` branch with no application schema or data. This avoids copying synthetic development data and avoids a migration-journal mismatch: every preview starts empty and applies the complete committed migration history. Preview branches never use `logos-web-production` or a migrated/data-bearing branch as a parent and never use ordinary data-copy branching. Each preview:

1. is created with the schema-only option and an explicit expiration;
2. receives committed migrations through a controlled migration credential;
3. receives the deterministic synthetic fixture;
4. supplies only its runtime URL to the access-protected Vercel Preview; and
5. is deleted when the pull request closes, with expiration as the safety net.

The standard Vercel–Neon branch-per-preview integration is not connected to the production project. Until free automation can guarantee schema-only creation and cleanup without exposing a privileged secret to forked code, provider-side/manual creation from the non-production project is the safe fallback.

## 11. Synthetic fixture policy

The fixture contains a fixed technical marker such as `logos-phase-02-synthetic`. It has no name, email address, school identifier, free text, or resemblance to a student record.

The loader is small and idempotent, uses a parameterized upsert, refuses `APP_ENV=production`, and fails if the database-side environment identity differs from `APP_ENV`. It targets only the dedicated infrastructure probe table. Reset behavior requires an explicit test/preview environment and never runs as part of application startup.

## 12. CI strategy

The existing CI workflow gains a database job using the official PostgreSQL 17 service image. It retains read-only repository permissions, SHA-pinned third-party Actions, timeouts, concurrency cancellation, and frozen pnpm installation.

The database job:

1. waits for the isolated service to become ready;
2. binds a database-side `test` identity using a local-only setup command;
3. generates or checks Drizzle migration artifacts;
4. migrates a fresh empty database and reruns the migrator;
5. creates real environment-local runtime and backup login roles outside migrations;
6. loads the deterministic fixture and proves production/mismatched identity guards reject it;
7. executes permission tests through those real logins, including `RESET ROLE` denial;
8. proves the database identity is the CI database and contains only synthetic data; and
9. exports through the backup login and restores through the owner into a separate database.

No Neon key or database URL is stored in GitHub for this job. Existing quality, browser, release, and security workflows remain intact.

## 13. Export and restore test

The rehearsal uses PostgreSQL 17 client tools and synthetic data only:

1. migrate the source test database;
2. load the synthetic fixture;
3. export through the read-only backup role using custom-format `pg_dump`;
4. create a distinct empty restore database;
5. restore with `pg_restore` under the migration owner;
6. compare expected schemas, migration history, and fixed marker rows; and
7. delete the temporary dump on exit.

PostgreSQL tools receive connection fields through libpq environment variables; URLs never enter process arguments or printed commands. The restore rehearsal verifies restored grants as well as the migration journal and marker. Dumps remain ignored and are never committed. Production backup scheduling, encryption, Drive archival, retention, and production restoration drills remain Phase 10 work.

## 14. Implementation sequence

1. Record this plan and mark Phase 02 current.
2. Add pinned database dependencies and safe package commands under Node.js 24.20.0.
3. Add server-only environment parsing and the Neon/Drizzle connection factory.
4. Add the minimal technical schema, role bootstrap, generated migration, and deterministic fixture loader.
5. Add isolated PostgreSQL permission, migration, fixture, and environment tests.
6. Add the CI database job and export/restore script.
7. Provision the two free Singapore Neon projects and non-production schema-only preview baseline after interactive account authorization.
8. Configure Vercel Preview variables only; leave Production dormant.
9. Run the full local, security, database, and browser gates.
10. Record completion evidence, push coherent commits, and open an unmerged pull request.

## 15. Verification evidence

Evidence recorded on 2026-08-31:

- repository `main` was clean and synchronized at `48ebe6d`;
- Node.js `24.20.0` is installed at the pinned path;
- AGY `1.1.22` and required model `gemini-3.7-flash-high` were verified;
- current first-party provider and package facts were rechecked;
- unrelated Release Please and Dependabot pull requests were identified and left untouched; and
- the dormant `production-disabled-until-phase-11` remote branch remains unchanged.
- a new PostgreSQL 17 container was created from the SHA-pinned CI image, and committed migrations succeeded from empty state;
- applying the migrator again completed as a no-op with the expected existing migration-schema notices;
- the deterministic technical fixture loaded through the runtime role;
- automated inspection confirmed all policy roles are `NOLOGIN`, non-superuser, unable to create databases or roles, runtime DML succeeds, runtime DDL fails, backup reads succeed, backup writes and DDL fail, and the future audit role cannot read;
- `pg_dump` through `logos_backup` and `pg_restore` into a separate empty database reproduced the migration history and fixed synthetic marker;
- frozen installation, formatting, lint, type checking, 44 unit/component tests, migration drift, production build, eight established Playwright smoke tests, release configuration, and the high-severity dependency audit passed under Node.js `24.20.0` and pnpm `11.24.0`;
- the dependency audit reports no known vulnerabilities after constraining the obsolete Drizzle Kit loader's nested `esbuild` to a compatible patched release;
- no Phase 02 visual or UI design verification was performed; the existing automated browser suite was run only as the established repository regression gate;
- a focused independent closeout review reproduced and removed a CI privilege-escalation path caused by authenticating as `postgres` and switching roles. CI now authenticates as real unprivileged runtime and backup logins, and `RESET ROLE` remains unprivileged;
- the same review replaced database-name-only fixture protection with an independent database-side environment identity and moved every PostgreSQL tool connection value out of process arguments;
- Neon Free (`$0`) hosts separate `logos-web-production` and `logos-web-nonproduction` PostgreSQL 17 projects in `aws-ap-southeast-1`; production was inspected with zero application tables and only its provider owner login;
- the non-production `development` branch contains the committed migration history, one technical table, and only the fixed synthetic fixture. Its independently generated runtime and backup logins were tested through real connections: runtime DML succeeds while DDL fails, backup reads succeed while writes fail, and neither login is a superuser, can create databases or roles, or belongs to `neon_superuser`;
- the provider Console cannot reset a password for a SQL-created passwordless role. Credentials were therefore generated and rotated through an out-of-band, short-lived administrative procedure; its temporary function was removed immediately, and no password or URL was printed or written to the repository;
- a hosted `phase-02-preview-verification` branch was created schema-only from the empty `preview-root-empty` non-production branch with automatic deletion on 2026-09-07. The real Drizzle migrator succeeded from empty state and reran as a no-op, its unique runtime login passed the same privilege restrictions, and its only row is the fixed synthetic marker;
- before closeout, Vercel Hobby held `DATABASE_URL` as a write-only Preview Secret and `APP_ENV` as Preview Config only; Development and Production received neither variable;
- after pull request #9 merged, the exact Preview `DATABASE_URL` was removed, `APP_ENV` remained Preview-only, `logos_preview_runtime` was set `NOLOGIN` and removed from `logos_runtime`, and the exact `phase-02-preview-verification` branch was deleted. A post-cleanup connection attempt to its retired endpoint failed; `development` and `preview-root-empty` remained present; and
- an automatically created, unused Neon signup project remains outside the LOGOS topology, has no Vercel connection, and was not deleted because deletion is destructive and unnecessary to Phase 02 isolation.

The first hosted development bootstrap was entered through the Neon SQL Editor and stopped before the Drizzle migration journal existed because raw SQL execution does not perform the migrator's journal setup. The missing journal and remaining grants were repaired with the committed migration's exact hash. The independently created hosted preview then proved the actual Drizzle migrator's clean empty-state and repeat-run behavior end to end.

AGY's first read-only assignments and one dependency/configuration assignment were denied shell-command access. Each prescribed tool-free or file-edit-only retry completed without weakening the worker security policy; Codex reviewed every result and continued the implementation locally.

## 16. Risks and mitigations

| Risk                                         | Mitigation                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Preview integration copies parent data       | Use schema-only branches exclusively inside the non-production project; never connect previews to production                      |
| Runtime receives owner privileges            | Create runtime and backup logins through SQL, grant only `NOLOGIN` group roles, and test DDL denial                               |
| Static build requires secrets                | Validate lazily on the first database operation, not at module import or build                                                    |
| Migration drift                              | Commit generated SQL/metadata and fail CI when regeneration changes tracked output                                                |
| Accidental production fixture                | Require explicit `APP_ENV`, refuse production, and verify database/project identity before fixture operations                     |
| Free branch/resource exhaustion              | Keep previews below the included concurrent limit, delete on PR close, and set expiration                                         |
| WebSocket transaction misuse or leaked pools | Centralize server-only construction, use one driver path, and close script/test pools                                             |
| Credential leakage in logs or artifacts      | Never echo URLs; sanitize errors; keep dumps, environment files, reports, and traces ignored                                      |
| Migration failure                            | Test from empty PostgreSQL 17, use forward-fix migrations, and rely on a tested restore path rather than editing deployed history |

## 17. Completion criteria

Phase 02 is complete when:

- this document records the implemented design and evidence;
- the roadmap records Phase 02 completion and identifies Phase 03 next;
- both Neon projects are confirmed Free, PostgreSQL 17, and `aws-ap-southeast-1`;
- production is empty, dormant, and isolated from all non-production credentials;
- preview branches are schema-only, synthetic, expiring, and production-independent;
- Drizzle and the Neon WebSocket driver are configured in server-only modules;
- migrations reproduce a fresh database and no domain table exists;
- runtime DDL and backup writes fail in automated tests;
- CI verifies migrations, fixtures, roles, isolation, and restore with no Neon secret;
- the synthetic export/restore rehearsal passes;
- all established repository and security checks pass under Node.js 24.20.0;
- no credential or personal data is tracked or displayed;
- several coherent Conventional Commits exist; and
- pull request #9 was squash-merged with `feat: establish data foundation`, and its post-merge CI, Security, Release Please, and Vercel checks passed.

## 18. Status

**Completed.** Pull request #9 was squash-merged as [`6e14e8b`](https://github.com/LOGOS-The-TIS-Math-Club/logos-web/commit/6e14e8b516555bd1199d86a4e70bc387f6dd5e08) after every required PR check passed. Post-merge CI, Security, Release Please, and Vercel checks passed. Fresh migration, role restrictions, environment isolation, and synthetic export/restore passed before acceptance; the expiring preview credential and branch were then retired without changing the preserved baselines or either LOGOS project. Phase 03 is next and has not started.
