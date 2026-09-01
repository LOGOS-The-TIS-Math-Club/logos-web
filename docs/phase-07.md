# Phase 07 — Essential Operations, Public Completion, Recovery Evidence, and Launch Readiness

> - Status: Active delivery plan
> - Project: LOGOS — The Tokyo International School Math Club
> - Repository: `LOGOS-The-TIS-Math-Club/logos-web`
> - Branch: `phase/07-operations-launch`
> - Date: 2026-09-01
> - Target: Club leadership, active members, public visitors, and maintainers

## 1. Objective and primary outcome

Deliver the smallest safe version of LOGOS that leadership can operate, that active members can use for core tasks, and that students can navigate after arriving from recruitment links.

The essential journey is:
**accepted application → deliberate membership activation → session & attendance operation → useful public information → launch-ready release**

The landing page and application intake remain the highest-quality surfaces. Member and leadership task pages remain minimal, fast, and strictly task-oriented.

## 2. Coexistence model and preserved invariants

### Membership coexistence model (conservative & additive)
- PostgreSQL is the operational authority for memberships deliberately created from native LOGOS applications.
- Existing Forms, Sheets, historical responses, and `logos-data-membership` remain preserved, untouched, and uncorrupted.
- No destructive cutover, automated backfill, or mass import is performed during this phase.
- Provenance is recorded for each native membership (`application_id`, `identity_id`, `created_by`).
- Accepting an application **never** automatically creates active membership.
- Leadership must perform a separate, deliberate, audited activation action.
- Technical access capabilities, club leadership titles, verified school affiliation, application status, and membership status remain strictly separate facts.

### System invariants
- Server-side default-deny authorization on all protected routes and API handlers.
- Immutable identity keys (`application_identities.id`) used for all relational integrity; email is mutable contact information.
- Append-only business audit journal records all membership activations, status changes, session creations, attendance ledger updates, and manual warnings.
- Expected absences are modeled separately from actual attendance records.
- Warnings are strictly manual records entered by authorized leadership with bounded reason codes; no automatic scoring or punishment engines.
- Additive, forward-only Drizzle migrations with least-privilege PostgreSQL grants.
- Complete logical backup and isolated restore verification with synthetic data before production launch.
- No secrets, no production credentials, no live provider mutations, and no real student PII.

## 3. Milestones and scope

### Milestone A — Essential operations
1. **Membership lifecycle**:
   - Deliberate activation of accepted student applications into `logos.club_members`.
   - Idempotent activation: duplicate active membership for the same identity is rejected at schema and service layers.
   - Preserves membership history across `active`, `inactive`, and `former` states without record deletion.
   - Provenance tracking linking back to `student_applications.id`.
2. **Sessions and attendance**:
   - Creation of club sessions (`logos.club_sessions`) with date, start/end time (defaults: Friday, 15:30–16:30), location (default: Room 101), and notes.
   - Attendance ledger (`logos.session_attendance`) with states: `unmarked`, `present`, `late`, `excused_absence`, `unexcused_absence`.
   - Distinct expected absence submissions (`logos.expected_absences`) submitted by members or recorded by leadership on their behalf.
   - Audited attendance corrections.
   - Rebuildable derived attendance totals.
3. **Manual warnings**:
   - Deliberate manual warning records (`logos.member_warnings`) with authorized issuer, bounded reason, active state, and audit event.
   - Zero automatic scoring, penalty points, or automated disciplinary logic.

### Milestone B — Minimal protected task surfaces
1. `/admin/members`: List members, filter by status, view application provenance, one-click deliberate activation of accepted applications, and status transition controls.
2. `/admin/sessions`: Create and list club sessions with editable meeting defaults.
3. `/admin/attendance`: Mark and correct attendance on session grids, view expected absence indicators, and record absences on behalf of members.
4. `/members`: Minimal member hub displaying membership status, upcoming meeting info, absence notification form, personal attendance summary, and approved links to Classroom and Drive.
5. Explicit capabilities in `lib/auth/capabilities.ts`: `membership:read`, `membership:manage`, `session:manage`, `attendance:record`, `warning:manage`.

### Milestone C — Public-site completion
1. Complete public content: About LOGOS, meeting schedule, Room 101 details, student leadership & faculty advisor information, competition & resource links, contact guidance.
2. Privacy information: Clear statement regarding student data protection, TIS account identification, data minimization, and contact process for correction or deletion.
3. Navigation & SEO: Accessible header/footer navigation, OpenGraph / Twitter metadata, skip links, semantic HTML, WCAG AA compliance.
4. Preserved Zinc/Mauve aesthetic and primary recruitment call-to-action.

### Milestone D — Recovery and launch readiness
1. Logical backup & restore verification script updated to assert Phase 07 tables, least-privilege permissions, and migration count (6 migrations).
2. Production launch runbooks and operational checklists documented in this file.
3. Zero indexation of private/authenticated areas (`noindex` headers).
4. Identification of user-assisted steps required before live traffic.

## 4. Database schema additions (logos schema)

- `logos.club_member_status` enum: `active`, `inactive`, `former`
- `logos.club_members` table: `id`, `identity_id`, `application_id`, `status`, `joined_at`, `left_at`, `status_reason`, `created_by_identity_id`, `updated_at`
- `logos.club_sessions` table: `id`, `title`, `session_date`, `start_time`, `end_time`, `location`, `notes`, `created_by_identity_id`, `created_at`, `updated_at`
- `logos.attendance_status` enum: `unmarked`, `present`, `late`, `excused_absence`, `unexcused_absence`
- `logos.session_attendance` table: `id`, `session_id`, `member_id`, `status`, `notes`, `recorded_by_identity_id`, `recorded_at`, `updated_at`
- `logos.expected_absence_status` enum: `submitted`, `acknowledged`, `cancelled`
- `logos.expected_absences` table: `id`, `member_id`, `session_date`, `reason`, `status`, `submitted_by_identity_id`, `created_at`, `updated_at`
- `logos.member_warnings` table: `id`, `member_id`, `issued_by_identity_id`, `reason`, `active`, `issued_at`, `resolved_at`, `resolved_by_identity_id`, `notes`

## 5. Commit sequence

1. `docs(phase-07): define compact operations and launch gate`
2. `feat(phase-07): add essential membership and attendance operations`
3. `feat(phase-07): complete public and protected task surfaces`
4. `docs(phase-07): add recovery and launch handoff`
5. Any focused correction commit required by verification.

## 6. Verification plan

- Focused unit & integration tests for membership activation, duplicate prevention, attendance ledger, expected absences, warnings, and authorization guards.
- Route tests for public pages, `/admin/members`, `/admin/sessions`, `/admin/attendance`, and `/members`.
- Database foundation test (`pnpm db:test`) and synthetic restore verification (`pnpm db:restore:verify`).
- Aggregate test suite (`pnpm check`): format, lint, typecheck, unit tests, migration checks, build, and E2E smoke tests.
- Accessibility review: automated Axe scans and keyboard navigation verification.
- Security review: CSRF protection, default denial, parameterized SQL, no PII leakage in logs or audit journals.

## 7. Launch runbook & operational procedures

### 7.1 Production environment inventory
- **Application Host**: Vercel (Singapore region `sin1`, Node.js 24 LTS)
- **Database**: Neon Serverless PostgreSQL (Singapore region `ap-southeast-1`)
- **Authentication**: Neon Auth with Google OAuth 2.0 (Identity-only scopes: `openid`, `email`, `profile`)
- **Error Diagnostics**: Sentry (sanitized client/server reporting, student PII redacted)
- **Analytics**: Vercel Web Analytics (Public routes only)

### 7.2 Database migration procedure
1. Pre-migration backup: Run `pg_dump` of current production database to a secure, encrypted storage location.
2. Verify migration SQL: Review `drizzle/0005_*.sql` to ensure all operations are additive and non-locking.
3. Apply migration: Execute `pnpm db:migrate` using the dedicated `logos_migration` role.
4. Verify schema: Execute read-only verification query confirming all 6 migrations are recorded in `drizzle.__drizzle_migrations`.

### 7.3 Isolated restore procedure
1. Create a fresh, isolated PostgreSQL database instance (`logos_restore_verification`).
2. Restore the latest backup dump using `pg_restore --exit-on-error --no-owner`.
3. Verify fixture markers, migration counts, table row counts, and least-privilege role privileges.
4. Drop the test restore database after verification.

### 7.4 Rollback & incident response procedure
1. If application error occurs post-deploy: Revert to previous Vercel deployment instantly via Vercel Dashboard / CLI (`vercel rollback`).
2. Database backward compatibility: Schema additions in Phase 07 are strictly additive (nullable columns and new tables only), ensuring older application code continues to run safely against the migrated database.
3. Access incident: Execute `deactivateApplicationIdentity` or revoke technical access via `/admin` or emergency bootstrap script.

### 7.5 Leadership access procedure
1. New leader signs in via Google OAuth using their `@tokyois.com` account.
2. Verified identity record is automatically associated with status `verified`.
3. Existing `access_admin` grants `operator` access level via `setTechnicalAccess(targetIdentityId, 'operator', reason, correlationId)`.
4. Initial bootstrap is performed once using `pnpm db:access:bootstrap` with `ACCESS_ADMIN_BOOTSTRAP_SECRET`.

### 7.6 Application-data access & CSV export procedure
1. Authorized operator navigates to `/admin/applications`.
2. Click "Export CSV" to trigger secure export API (`/api/admin/applications/export`).
3. Export is generated with formula-injection escaping (all cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` prefixed with `'`).
4. Export event is logged to `business_audit_journal`.

### 7.7 Credential ownership & revocation checklist
- [ ] Neon database owner password stored securely in team password manager.
- [ ] Neon Auth Google OAuth client ID & secret configured in Vercel environment variables.
- [ ] CSRF signing secret (`CSRF_SIGNING_SECRET`) is a minimum 32-character high-entropy secret.
- [ ] Bootstrap secret (`ACCESS_ADMIN_BOOTSTRAP_SECRET`) rotated after initial access admin provisioning.
- [ ] No API keys, credentials, or tokens committed to git history.

### 7.8 Legacy resource preservation statement
- Google Forms and Sheets previously used for recruitment, membership tracking, and absence reporting remain intact.
- No legacy data has been modified, overwritten, or destroyed.
- Legacy records are treated as read-only historical archives.

### 7.9 Post-launch smoke checklist
1. Visit public landing page `/`: verify copy, meeting schedule, Room 101, leadership, resources, and privacy information.
2. Click "Apply to LOGOS": verify `/apply` form renders, validates inputs, and requires `@tokyois.com` Google identification.
3. Submit synthetic test application: verify confirmation page `/apply/confirmation` and duplicate submission prevention.
4. Sign in as operator: verify `/admin/applications` lists submission and enables CSV export.
5. In `/admin/applications`: accept test application and activate membership in `/admin/members`.
6. In `/admin/sessions`: create Friday club session (15:30–16:30, Room 101).
7. In `/admin/attendance`: record attendance for active members and verify ledger totals.
8. As active member: navigate to `/members`, verify status, view session, and submit expected absence.
9. Attempt unauthorized access to `/admin/*`: verify strict 403 Access Denied.
