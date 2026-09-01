# Phase 06 — Recruitment Landing Page and Student Applications

> - Status: Implementation in progress
> - Project: LOGOS — The Tokyo International School Math Club
> - Repository: `LOGOS-The-TIS-Math-Club/logos-web`
> - Branch: `phase/06-recruitment-applications`
> - Date: 2026-09-01
> - Target: Grades 9–12 applicants and authorized club leadership

## 1. Objective and expected outcome

Implement the recruitment landing page and student application flow for LOGOS. A student scanning a poster link arrives at a fast, polished, accessible landing page, learns about LOGOS, applies with a focused form, identifies via authenticated Google account (`@tokyois.com`), and receives a clear confirmation. Authorized club leadership can access, review, and export submitted applications through a dedicated `/admin/applications` interface.

## 2. Dependencies and preserved invariants

This phase builds directly upon the established foundations:
- **Phase 01 / Design tokens:** Dark-first zinc-950 background, zinc-900/800 surfaces, zinc-100 text, zinc-400 muted text, zinc-500 borders, mauve-400 accent, WCAG AA contrast, and reduced-motion support.
- **Phase 02 / Database:** Drizzle ORM, PostgreSQL schema migrations in `logos` schema, and server-only transactions.
- **Phase 03 / Security:** Origin/CSRF protection, structured redaction, security and business audit journals, rate limiting, and durable operation patterns.
- **Phase 04 / Identity:** Google identity association (`application_identities`), verified `@tokyois.com` hosted-domain evidence, and capability-based authorization.
- **Preserved invariants:**
  - Google sign-in is an identification and affiliation proof step only. It does not create membership, grant operator capabilities, or open an empty student dashboard.
  - Student email and immutable Google subject are derived solely from the verified server session and never typed into the form.
  - Active application submissions are strictly one per immutable Google identity.
  - Least privilege database access with no manual production DB alterations.

## 3. Approved application questions

| # | Exact User-Facing Label / Question | Field Type & Choices | Required | Validation & Limits | Purpose |
|---|---|---|---|---|---|
| **1** | Preferred name | Short Text | Required | Trimmed text, 1–80 chars | Preferred name for club communications and meetings. |
| **2** | Grade / Year level | Single Select (Grade 9, Grade 10, Grade 11, Grade 12) | Required | Enum match | Determines division eligibility and peer groupings. |
| **3** | Mathematical interests | Multi-Select (Problem solving, Algebra, Geometry, Number theory, Combinatorics, Logic & puzzles, Applied mathematics, Other) | Required | Array of 1–8 valid interest keys | Guides session topic selection and problem sets. |
| **4** | Why would you like to join LOGOS? | Textarea | Required | 30–500 chars | Assesses motivation and engagement intent. |
| **5** | What would you like to learn or contribute? | Textarea | Required | 30–500 chars | Informs collaborative activities and peer workshops. |
| **6** | Relevant background or experience (optional) | Textarea | Optional | 0–500 chars (No prior competition experience required) | Optional background context. |
| **7** | Can you normally attend regular club meetings? (Every Friday after school, 15:30–16:30, Room 101) | Single Select (Yes, I can attend regularly / Usually, but I may have occasional conflicts / No, I have an ongoing scheduling conflict) | Required | Enum match | Assesses attendance availability. |
| **8** | Accuracy and communication acknowledgement | Single Checkbox | Required | Must be checked (`true`) | “I confirm that the information provided is accurate and understand that LOGOS may use my verified TIS email for club-related communication.” |

## 4. Scope and non-goals

### In scope
- Public recruitment landing page (`/`) highlighting LOGOS mission, meeting details, non-prerequisite policy, and primary call to action.
- Application form (`/apply`) with progressive enhancement, accessible validation, client/server Zod enforcement, and session affiliation check.
- Application confirmation page (`/apply/confirmation`) and duplicate/error handling.
- Drizzle schema and migration for `logos.student_applications` with status lifecycle (`submitted`, `reviewing`, `accepted`, `declined`).
- Atomic submission and audit logging in PostgreSQL.
- Leadership review portal (`/admin/applications`) with status filtering, application detail view, status update, and CSV export.
- Explicit capabilities: `application:review` and `application:export`.
- Formula injection protection for CSV exports.
- Rate limiting on submission endpoints and CSRF protection.

### Non-goals
- Student member dashboard or portal widgets.
- Automatic membership creation or role conversion (owned by Phase 07).
- Attendance, absences, or warning tracking.
- Google Classroom or Drive syncing.
- Production OAuth/provider console provisioning.
- Real student PII data.
- Phase 07 launch activities.

## 5. Deliverables

1. `db/schema.ts` & additive Drizzle migration for `student_applications`.
2. `lib/applications/`: validation schemas, repository functions, application submission service, status transitions, and CSV generation with formula-injection escaping.
3. `lib/auth/capabilities.ts`: `application:review` and `application:export` mapped explicitly to `operator`.
4. `app/page.tsx`: Updated recruitment landing page.
5. `app/apply/page.tsx` & `app/apply/confirmation/page.tsx`: Accessible student application experience.
6. `app/admin/applications/page.tsx` & `app/api/admin/applications/export/route.ts`: Leadership application review and export.
7. Comprehensive test suite covering validation, authorization, duplicate handling, accessibility, and CSV security.

## 6. Security, privacy, data, and migration requirements

- **Data minimization:** No addresses, phone numbers, medical information, or unbounded text fields.
- **Session verification:** `identityId` and school email are resolved strictly from the verified session; missing or unverified affiliation fails closed.
- **Duplicate prevention:** Unique constraint on active applications per `identity_id`.
- **Authorization:** Protected endpoints require explicit `application:review` or `application:export` capability. Default deny for unauthorized users.
- **Audit trail:** Application submissions, status changes, and exports are recorded to the append-only audit journal with bounded reason codes and redacted metadata.
- **CSV formula injection prevention:** Cells beginning with `=`, `+`, `-`, `@`, `\t`, `\r` are prefixed with `'` (apostrophe), and double quotes are escaped.
- **Forward-only migration:** All database changes use additive Drizzle migrations.

## 7. Commit plan

1. `docs(phase-06): define recruitment and application flow`
2. `feat(phase-06): add recruitment and application experience`
3. `test(phase-06): verify application security and accessibility`

## 8. Focused verification

- Application validation schema and character constraints.
- Identity resolution and affiliation enforcement.
- Duplicate active application prevention.
- Leadership capability check and unauthorized access denial.
- Status transitions and audit trail durability.
- CSV export formula injection escaping and content headers.
- End-to-end poster-to-application journey with synthetic identity.
- Full `pnpm check` and security review.

## 9. Completion gate

- [ ] Approved application questions implemented and documented.
- [ ] Recruitment landing page clearly articulates club values and provides strong CTA.
- [ ] Application submission verifies `@tokyois.com` identity server-side.
- [ ] Duplicate and failure states handled safely with friendly user feedback.
- [ ] Submissions and status modifications are atomic and audited.
- [ ] Leadership can filter, review, update status, and securely export applications.
- [ ] All automated tests pass; accessibility and security reviews find no material blockers.
- [ ] One unmerged PR opened with clean CI.
