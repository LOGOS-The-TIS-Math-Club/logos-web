# Phase 00 — Project and Delivery Foundation

> - Status: Planned
> - Roadmap: [roadmap.md](./roadmap.md)
> - Architecture: [architecture.md](./architecture.md)
> - Predecessor: None
> - Successor: `phase-01.md`
> - First release target: `0.1.0`
> - Unreleased manifest version: `0.0.0`
> - Last updated: 2026-08-30

## 1. Objective

Establish a reproducible, secure, and conventionally structured foundation for LOGOS Web. The phase creates the application scaffold, development tooling, automated checks, repository automation, and protected delivery path required by every later phase.

Phase 00 introduces no club workflows and uses no student data or application-level database, OAuth, authentication-provider, or Google Workspace credentials. Provider-managed GitHub and Vercel integration authorization is permitted only for establishing the delivery path.

## 2. Expected outcome

At completion, a contributor can clone the private repository, install the pinned toolchain, run the application, execute every quality check, and reproduce the verified Vercel Preview and main-branch deployments by following the documented commands.

The result is intentionally plain. It proves that the engineering foundation works without prematurely implementing the LOGOS design system, data model, authentication, or product features.

## 3. Architecture alignment

Phase 00 establishes the development baseline defined by the architecture:

- Next.js with App Router
- Latest stable Next.js and React selected at initialization
- TypeScript in strict mode
- Node.js 24 LTS
- pnpm with a pinned version and committed lockfile
- Tailwind CSS installed as the styling foundation
- Official Next.js ESLint rules
- Prettier
- Conventional `@/*` import alias
- Root-level `app/` directory with no `src/` wrapper
- Vitest, React Testing Library, and Playwright
- GitHub Actions, Dependabot, and Release Please
- Vercel hosting with Singapore dynamic-region configuration
- Simplified Conventional Commits and Semantic Versioning

Official framework-generated structure and naming conventions are retained. Phase 00 does not introduce a custom project organization merely to anticipate future work.

## 4. Scope

### 4.1 Runtime and package foundation

- Record Node.js 24 LTS as the supported runtime.
- Pin the selected pnpm version through the conventional package-manager metadata.
- Initialize the private, unreleased `package.json` at `0.0.0`; configure the first tagged release target as `0.1.0`.
- Commit `pnpm-lock.yaml`.
- Provide reproducible installation with a frozen lockfile.
- Preserve the existing MIT license, categorized `.gitignore`, documentation, and Git history.

### 4.2 Next.js application scaffold

- Initialize the current stable Next.js and React releases in the existing repository.
- Use App Router and strict TypeScript.
- Install Tailwind CSS without selecting the final LOGOS palette mapping or visual identity.
- Configure the `@/*` import alias.
- Use the official root-level `app/` structure with no `src/` wrapper, and keep conventional framework folders and filenames.
- Provide a minimal, neutral, accessible page that proves rendering works.
- Provide a minimal dynamic health Route Handler that exposes no configuration values and allows the deployed function region to be verified through redacted platform evidence.
- Apply baseline response protections: a restrictive initial Content Security Policy, frame protection, `X-Content-Type-Options`, Referrer Policy, and a minimal Permissions Policy.

### 4.3 Code quality and test foundation

- Configure the official Next.js ESLint rules.
- Configure Prettier without conflicting style systems.
- Provide conventional package scripts for:
  - development;
  - production build and start;
  - formatting and formatting checks;
  - linting;
  - strict type-checking;
  - unit/component tests;
  - browser smoke tests;
  - an aggregate non-watch verification command.
- Establish Vitest and React Testing Library with a minimal passing unit or component test.
- Establish Playwright with a browser smoke test proving the application loads.
- Keep CI authoritative; no local Git hooks are introduced.

### 4.4 GitHub quality and maintenance automation

At planning time, the private repository belongs to the `LOGOS-The-TIS-Math-Club` organization on GitHub Free. GitHub does not provide protected branches or rulesets for private organization repositories on that plan. Before this phase can move to **Ready**, the organization must use a plan that supports protection for private repositories. GitHub Team is the architecture-compatible path; making the repository public would instead require an explicit architecture amendment and exposure review. See GitHub's [protected-branch availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

- Add pull-request and `main` GitHub Actions checks.
- Use frozen-lockfile installation in CI.
- Run formatting, ESLint, strict TypeScript, automated tests, production build, and browser smoke verification.
- Scan committed content and complete Git history for secrets with Gitleaks; the scan job checks out full history rather than the default shallow clone.
- Run `pnpm audit --audit-level high` against the locked dependency graph.
- Pin every external GitHub Action, including GitHub-maintained `actions/*`, to a full commit SHA and record its human-readable version in a comment. Repository-local Actions are the only exception.
- Default workflow permissions to read-only contents; isolate the write permissions required by Release Please in its own workflow.
- Set `persist-credentials: false` on checkout steps in ordinary build, test, and security jobs.
- Never expose secrets or a write-capable token to untrusted pull-request code, and never execute an untrusted checkout from a privileged `pull_request_target` workflow.
- Configure weekly grouped Dependabot updates for pnpm and GitHub Actions.
- Surface security updates without automatically merging major upgrades.
- Configure Release Please for the approved Conventional Commit and SemVer workflow.
- Verify that the repository remains private.
- Normalize the local `origin` remote to the repository's canonical organization URL.
- Protect `main` before this phase closes: require pull requests and required checks, block force pushes and deletion, and prohibit routine administrator bypass.

The exact required reviewer count and eligible break-glass actors remain deferred. Any platform-supported emergency bypass is never routine and requires a recorded reason, named actor, and follow-up review.

### 4.5 Vercel delivery baseline

Before this phase can move to **Ready**, confirm that this non-commercial school-club project is eligible for the intended Vercel plan and that the account can enable Vercel Authentication. If those conditions fail, hosting cost or platform selection requires an architecture decision before implementation continues.

- Connect the GitHub repository to the intended Vercel project.
- Limit the Vercel GitHub App authorization to this repository.
- Configure the dynamic function region for Singapore (`sin1`).
- Establish separate development, preview, and production environment categories.
- Deploy and smoke-test the neutral application in Preview and in the main-branch deployment Vercel labels **Production**.
- Keep Vercel Authentication enabled for every Preview and Production deployment through Phase 10, and apply `noindex, nofollow` as defense in depth.
- Ensure preview receives no production database URL, OAuth token, Workspace credential, or student data.
- If automated smoke tests require a deployment-protection bypass token, keep it as a narrowly scoped CI secret and withhold it from untrusted pull requests. Record its owner and rotation/revocation procedure; never place it in a URL, pull-request comment, trace, screenshot, log, or closeout evidence.
- Keep analytics disabled until Phase 06 can enforce the public-route-only boundary.

Merging `main` therefore creates a technical Production deployment, not a public launch. Phase 00 configures no public custom domain and introduces no production club data; Phase 11 alone authorizes removal of pre-launch protection.

### 4.6 Documentation

Update the README with:

- project purpose;
- supported Node.js and pnpm versions;
- installation and local-development commands;
- verification commands;
- high-level project structure;
- links to the architecture, roadmap, and active phase plan;
- simple Conventional Commit guidance;
- environment-file and secret-handling rules;
- the services intentionally not configured during Phase 00.

## 5. Non-goals

Phase 00 does not include:

- the final LOGOS color selections, typography, imagery, or visual identity;
- shadcn/ui initialization or the reusable component system;
- final navigation, sitemap, or public content;
- Neon PostgreSQL, Drizzle schemas, migrations, or database credentials;
- Neon Auth, Google OAuth, sessions, or authorization;
- Calendar, Drive, Classroom, or Gmail integration;
- Sentry or Vercel Web Analytics data collection;
- membership, applications, absence, attendance, warning, content-management, or leadership features;
- user uploads;
- real student records or copies of existing Forms and Sheets;
- a custom domain or public production launch.

## 6. Deliverables and evidence

| Deliverable | Expected evidence |
| --- | --- |
| Reproducible runtime | Runtime file or engine constraint, pinned pnpm metadata, and frozen-lockfile installation |
| Conventional Next.js scaffold | App Router project that renders and builds successfully |
| Strict code-quality configuration | Passing formatting, ESLint, and TypeScript checks |
| Test harnesses | Passing Vitest/React Testing Library example and Playwright smoke test |
| CI pipeline | Successful pull-request workflow covering every required check |
| Repository automation | Dependabot and Release Please configurations recognized by GitHub |
| Supply-chain baseline | Passing Git-history secret scan and high-severity dependency audit; Actions pinned and permissions minimized |
| Protected production branch | Pull request and required-check rules active; ordinary force pushes, deletion, and routine bypass blocked |
| Protected delivery | Working Vercel Preview and main-branch deployment behind authentication, with Singapore dynamic-region evidence |
| Safe environment boundary | No production secrets, credentials, or student data in code, CI, or preview |
| Contributor documentation | README accurately reproduces setup and verification |

## 7. Work order and commit checkpoints

Planning documentation is established before implementation and does not replace the multiple implementation commits required during the phase.

The expected checkpoints are:

1. `chore: scaffold next.js application`
2. `build: configure project tooling`
3. `test: establish automated test foundation`
4. `ci: add repository quality checks`
5. `ci: configure dependency and release automation`
6. `build: configure vercel preview deployment`
7. `docs: document project foundation`

These messages are planning examples rather than immutable wording. Closely related changes may be combined when that produces clearer history, and an additional `fix`, `test`, or `docs` commit may be added when it represents a genuine checkpoint.

Each commit should:

- contain one coherent concern;
- use the simple Conventional Commit format;
- pass the checks available at that point;
- avoid unrelated future-phase work;
- exclude secrets, generated output, and local environment files.

The phase branch may contain multiple conventional commits. Its pull request is squash-merged using a conventional title such as:

```text
chore: establish project foundation
```

## 8. Semantic Versioning and release effect

Phase 00 keeps the private manifest at `0.0.0`, sets `0.1.0` as the explicit first release target, and configures Release Please so a dry run or equivalent evidence confirms that bootstrap behavior. It does not by itself declare the website production-ready.

The phase is primarily `chore`, `build`, `test`, `ci`, and `docs` work, so its individual commits do not normally require a product-version increment. No tag is required solely to close Phase 00. When the first accepted releasable milestone arrives, its release proposal must be `0.1.0`, after which the manifest and tag follow normal Semantic Versioning.

## 9. Security and data handling

- No real student information is used in local development, tests, CI, or preview.
- No application, database, OAuth, Workspace, or student-data credential is created or stored in the repository.
- The Vercel GitHub App is limited to this repository. Provider-managed integration authorization and CI tokens use the minimum permissions needed for their single purpose.
- Any example environment file contains names and documentation only, never usable values.
- Preview and CI receive no production Workspace or database access. Any test credential is least-privileged, independently revocable, and withheld from untrusted contributions.
- Build output, logs, test artifacts, environment files, and database exports remain ignored.
- Completion evidence uses synthetic or redacted content and contains no credentials, student information, or sensitive form data.
- Gitleaks and the high-severity dependency audit cover runtime and development dependencies and pass before completion.
- Every high or critical advisory is remediated or recorded with evidence that it is a false positive or inapplicable to the locked dependency graph; informal claims of non-exploitability are insufficient.
- Baseline security headers are verified in this phase; Phase 03 evolves them alongside the complete application threat model.

## 10. Verification plan

### 10.1 Fresh-clone verification

Verification starts from a clean clone rather than an already prepared working directory:

1. confirm the supported Node.js 24 LTS line;
2. confirm the pinned pnpm version;
3. install with the frozen lockfile;
4. run the aggregate verification command;
5. run the production build;
6. start the application and load the neutral page;
7. run the Playwright smoke test;
8. confirm that verification leaves the working tree clean.

### 10.2 Required command outcomes

The project exposes documented commands equivalent to:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm check
```

Exact script composition may follow current official conventions, but each outcome must remain independently runnable in CI.

### 10.3 GitHub verification

- A pull request runs every required workflow.
- A deliberately failing check prevents ordinary merge.
- Required checks are visible in branch protection.
- Ordinary force pushes to `main` are blocked.
- Branch deletion and routine administrator bypass are blocked.
- Dependabot recognizes pnpm and GitHub Actions configuration.
- Release Please recognizes the repository configuration.
- Gitleaks scans the committed repository with a full-history checkout, and the dependency audit covers runtime and development dependencies.
- External Actions are pinned to full commit SHAs, ordinary checkout credentials do not persist, and workflow permissions are least-privileged.
- No untrusted pull-request workflow receives a secret or write-capable token.

### 10.4 Vercel verification

- A pull request produces a working, access-protected Preview deployment.
- A controlled merge produces the protected main-branch deployment Vercel labels Production without making it a public launch.
- Both deployments use the committed build and package-manager settings and return `noindex, nofollow`.
- The dynamic health Route Handler succeeds, reveals no environment values, and provides redacted platform evidence that Singapore (`sin1`) handled the function.
- No database, OAuth, Workspace integration, analytics, or real user data exists in either deployment.
- Any CI bypass credential is narrowly scoped, unavailable to untrusted pull requests, absent from URLs and evidence, and has a tested revocation path that does not disable deployment protection.

## 11. Completion gate

Phase 00 is complete only when:

- a fresh clone can be installed and verified using the README;
- the pinned runtime, pnpm version, and lockfile reproduce the environment;
- formatting, ESLint, strict TypeScript, unit/component tests, browser smoke tests, and production build all pass locally and in CI;
- the minimal application loads without browser-console errors;
- protected Vercel Preview and main-branch delivery work without production credentials or data, and the dynamic `sin1` route is evidenced;
- required pull-request checks, force-push and deletion protection, and the no-routine-bypass policy are active;
- Dependabot and Release Please are configured and recognized;
- full-history secret scanning, runtime/development dependency review, Action SHA pinning, non-persistent checkout credentials, and least-privilege workflow permissions pass;
- baseline response headers and `noindex, nofollow` are verified;
- the repository remains private and contains no secrets, database exports, generated build output, or student information;
- the README and planning links are accurate;
- implementation consists of multiple coherent Conventional Commits;
- accepted work is squash-merged into a clean `main`.

No later-phase functionality is required to satisfy this gate.

## 12. Handoff to Phase 01

The Phase 00 closeout records:

- merge commit and pull-request reference;
- exact Node.js, pnpm, Next.js, React, and major tooling versions;
- available package scripts;
- CI workflow names and passing status;
- Dependabot and Release Please status;
- branch-protection status;
- Vercel project and preview evidence without secret values;
- accepted deviations, if any, and the architecture record that authorizes them.

Phase 01 begins from this verified foundation and owns the semantic Tailwind token system, application shell, accessibility primitives, and selective shadcn/ui adoption.

## 13. Completion record

This section is populated when the completion gate passes. Until then, the authoritative status remains **Planned**.

The closeout record will contain:

- completion date;
- accepted pull request and merge commit;
- release or development version;
- evidence that the first Release Please proposal will target `0.1.0`;
- verification evidence;
- approved deviations;
- handoff confirmation for Phase 01.
