# LOGOS Web

LOGOS Web is the website for The Tokyo International School Math Club. The repository currently contains the Phase 01 interface foundation and the completed Phase 02 PostgreSQL implementation awaiting protected merge: an accessible application shell, reproducible tooling, server-only database access, reviewable Drizzle migrations, least-privilege database roles, and isolated synthetic verification.

The source is available under the [MIT License](./LICENSE). No student data, production credentials, or club workflows belong in this phase.

## Toolchain

| Tool              | Version       |
| ----------------- | ------------- |
| Node.js           | `24.20.0` LTS |
| pnpm              | `11.24.0`     |
| Next.js           | `16.3.3`      |
| React / React DOM | `19.2.8`      |
| TypeScript        | `5.9.3`       |

Use the exact Node.js version in [`.node-version`](./.node-version). The `packageManager` field in `package.json` pins pnpm.

## Setup

```bash
git clone https://github.com/LOGOS-The-TIS-Math-Club/logos-web.git
cd logos-web
npm install --global pnpm@11.24.0
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. The non-sensitive health route is available at <http://localhost:3000/health>.

Database-free application development requires no environment variables. For Phase 02 database work, copy the names from [`.env.example`](./.env.example) into an ignored `.env.local` and obtain non-production values through an approved secret store. Never reuse production credentials locally.

Database commands are explicit and never run during application startup or build:

```bash
pnpm db:check
pnpm db:migrate
pnpm db:fixtures
pnpm db:test
pnpm db:restore:verify
```

Use `MIGRATION_DATABASE_URL` only for migrations. `DATABASE_URL` is the least-privilege runtime connection, `TEST_DATABASE_URL` is a disposable isolated test owner connection, and `BACKUP_DATABASE_URL` is read-only. Fixture, permission, and restore commands refuse `APP_ENV=production`. See [Phase 02](./docs/phase-02.md) for the topology and credential boundary.

## Verification

Run the complete local gate:

```bash
pnpm check
```

The checks are also independently available:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm build
pnpm test:e2e
pnpm release:verify
pnpm audit --audit-level high
```

`pnpm test:e2e` builds the production application and runs the Chromium suite verifying landmarks, keyboard navigation, responsive viewports (320px to 1440px), horizontal overflow, reduced motion, security headers, and automated WCAG accessibility via `@axe-core/playwright`. CI installs Chromium separately and runs the same tests against `next start`.

## Project structure

```text
app/                         App Router pages, route handlers, and status templates
components/                  Reusable UI primitives and application shell
db/                          Drizzle schema declarations
drizzle/                     Committed SQL migrations and metadata
e2e/                         Playwright smoke and accessibility tests
lib/                         Server-only database boundary and shared modules
scripts/                     Repository and database verification scripts
.github/workflows/           Read-only CI/security and isolated release automation
docs/architecture.md         System-wide architecture authority
docs/roadmap.md              Phase order and broad completion gates
docs/phase-00.md             Completed project and delivery foundation
docs/phase-01.md             Completed interface and design-system foundation evidence
proxy.ts                     Nonce-based CSP and baseline response headers
vercel.json                  Singapore dynamic-function region
```

The application uses the root-level `app/` convention, strict TypeScript, the `@/*` import alias, React Server Components by default, Tailwind CSS with semantic Mauve Precision tokens referencing official Tailwind palette variables (dark default), and Turbopack through the standard Next.js commands.

## Contributions

Work on a short-lived branch and open a pull request into protected `main`. Use a simple Conventional Commit message:

```text
type: short imperative description
```

Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, and `chore`. Run `pnpm check` before requesting review. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the complete baseline.

## Security and secrets

This is a public repository. Never commit or attach:

- `.env` files or usable credentials;
- tokens, cookies, OAuth material, private keys, or deployment-protection bypass values;
- student names, email addresses, applications, attendance, absence, warning, or membership information;
- database exports, production logs, screenshots, traces, or test artifacts containing sensitive values.

Local secrets belong only in ignored `.env.local` files. Credential-bearing PostgreSQL roles are created through secure provider controls or an out-of-band administrative procedure, never by committed migrations. GitHub, Neon, and Vercel secrets must use their provider-managed secret stores with the smallest possible scope. Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md), never in a public issue.

## Delivery boundary

GitHub Free and Vercel Hobby are the only approved plans. Pull requests and `main` receive access-protected Vercel Preview deployments in Singapore (`sin1`). Vercel Hobby cannot protect a Production domain at no cost, so no Production deployment is published before the Phase 11 launch gate. The existing `tislogos.org` registration may remain attached to the Vercel project, but retaining the domain is not authorization to serve a Production deployment through it. Analytics remains disabled.

## Intentionally deferred

Phase 02 establishes infrastructure only. It does not add domain tables, authentication, Google OAuth or Workspace APIs, Sentry, analytics, public Production delivery through the retained custom domain, student data, membership, attendance, absence, warning, content-management, or leadership functionality.

Read the [architecture](./docs/architecture.md), [roadmap](./docs/roadmap.md), [Phase 00 plan](./docs/phase-00.md), and completed [Phase 01 record](./docs/phase-01.md) before proposing changes that affect providers, security boundaries, data, or later phases.
