# LOGOS Web

LOGOS Web is the website for The Tokyo International School Math Club. The repository currently contains the Phase 00 engineering foundation: a deliberately neutral Next.js application, reproducible tooling, automated tests, security checks, and protected preview delivery.

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

Phase 00 requires no environment variables. Do not create environment files unless a later approved phase documents the exact variables and ownership.

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
pnpm build
pnpm test:e2e
pnpm release:verify
pnpm audit --audit-level high
```

`pnpm test:e2e` builds the production application and runs the intentionally small Chromium smoke suite. CI installs Chromium separately and runs the same tests against `next start`.

## Project structure

```text
app/                         App Router pages and route handlers
e2e/                         Playwright smoke tests
scripts/                     Deterministic repository verification scripts
.github/workflows/           Read-only CI/security and isolated release automation
docs/architecture.md         System-wide architecture authority
docs/roadmap.md              Phase order and broad completion gates
docs/phase-00.md             Active foundation plan and evidence
proxy.ts                     Nonce-based CSP and baseline response headers
vercel.json                  Singapore dynamic-function region
```

The application uses the root-level `app/` convention, strict TypeScript, the `@/*` import alias, React Server Components by default, Tailwind CSS as an uncustomized styling foundation, and Turbopack through the standard Next.js commands.

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

Local secrets belong only in ignored `.env.local` files when a later phase explicitly requires them. GitHub and Vercel secrets must use their provider-managed secret stores with the smallest possible scope. Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md), never in a public issue.

## Delivery boundary

GitHub Free and Vercel Hobby are the only approved plans. Pull requests and `main` receive access-protected Vercel Preview deployments in Singapore (`sin1`). Vercel Hobby cannot protect a Production domain at no cost, so no Vercel Production deployment or domain is created before the Phase 11 launch gate. Analytics remains disabled.

## Intentionally deferred

Phase 00 does not configure final visual design, shadcn/ui, Neon, Drizzle, a database, authentication, Google OAuth or Workspace APIs, Sentry, analytics, a custom domain, student data, membership, attendance, absence, warning, content-management, or leadership functionality.

Read the [architecture](./docs/architecture.md), [roadmap](./docs/roadmap.md), and [Phase 00 plan](./docs/phase-00.md) before proposing changes that affect providers, security boundaries, data, or later phases.
