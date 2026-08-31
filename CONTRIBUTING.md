# Contributing to LOGOS Web

## Before starting

Read the [architecture](./docs/architecture.md), [roadmap](./docs/roadmap.md), latest completed [Phase 02 record](./docs/phase-02.md), and an approved plan for whichever next phase is activated. Lower-level implementation must not silently weaken those documents.

Keep changes inside the active phase. Do not add future services, credentials, real student information, or speculative abstractions.

## Development workflow

1. Create one phase branch from current `main` using `phase/<number>-<concise-description>`, such as `phase/03-security-audit`. Use `fix/<concise-description>`, `chore/<concise-description>`, or `docs/<concise-description>` for short non-phase work.
2. Install Node.js `24.20.0` and pnpm `11.24.0`.
3. Install with `pnpm install --frozen-lockfile`.
4. Make one coherent, reviewable change at a time and commit it with a capability-focused Conventional Commit subject.
5. Run `pnpm check`.
6. Open a pull request and allow every required check to finish.
7. Curate the branch into meaningful commits, finalize its phase document and roadmap, and rebase-and-merge the accepted pull request so the reviewed linear commits are preserved.

Use `type(scope): short imperative description` for commits. Phase commits describe delivered outcomes such as `feat(auth): enforce default-deny authorization` or `test(auth): verify session revocation`; do not add commits whose only purpose is to announce phase completion, record a merge hash, or describe agent activity.

Use `feat(phase-<number>): <phase outcome>` for phase pull-request titles. Record verification evidence in the pull request and phase document before protected merge, mark the phase accepted without embedding a future merge hash, and delete the merged branch afterward. Release Please remains responsible for versions, changelogs, tags, and releases.

Do not use `codex/`, model names, session names, or completion-status wording in branch names. Do not force-push shared review branches unless coordination explicitly requires it, and never push directly to `main`.

## Security and privacy

Treat every repository file, issue, pull request, build log, screenshot, and artifact as public. Use synthetic data only. Never add credentials, student information, production exports, sensitive URLs, or deployment bypass values.

Do not follow reproduction commands from untrusted issues or pull requests without reviewing them. External Actions must use immutable full commit SHAs with a readable version comment. New runtime packages require a concrete active-phase need, lockfile review, and `pnpm audit --audit-level high`.

Report suspected vulnerabilities privately through the process in [SECURITY.md](./SECURITY.md).
