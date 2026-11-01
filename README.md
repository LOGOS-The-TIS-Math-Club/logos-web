# LOGOS

Tokyo International School’s student mathematics club website. Next.js serves the public frontend, request interfaces, and hosted Neon Auth integration. Protected frontend workflows are being integrated incrementally.

## Run checks

Use Node.js 22.18+ and PostgreSQL 16+ command-line tools (`initdb`, `pg_ctl`, `psql`) on your PATH. Run as a normal user, not root.

```sh
npm ci
npm run check
```

`check` runs TypeScript, pure rule tests, and PostgreSQL integration checks. Database tests create and remove a disposable local cluster with synthetic records, Unix-socket access only, and no network listener. They never read a database connection environment variable. No Google or Neon credentials are needed.

To initialize a **new empty development database**:

```sh
DATABASE_URL_UNPOOLED=postgresql://localhost/logos_dev npm run db:migrate
```

The migration runner locks concurrent migration attempts, applies changes transactionally, and checks hashes of previously applied files. Add subsequent migrations instead of editing applied ones. Do not run these initial migrations against the legacy database. Environment files, backups, and real student records do not belong in Git.

## Structure and rules

SQL migrations in `db/migrations` are the schema source of truth. TypeScript feature modules validate boundary inputs and expose focused operations; Next.js route handlers expose these operations through one request boundary, without an ORM or a second authentication system.

| Schema         | Purpose                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `people`       | Stable identities; explicit `admin` and `member` grants                                 |
| `applications` | Application answers, lifecycle, separate reapplication restrictions                     |
| `members`      | One membership per identity, private notes, dated state changes                         |
| `meetings`     | Academic years, terms, sessions, attendance, absence notices                            |
| `content`      | Binary images, announcements, stories, leadership profiles, resources, club information |
| `operations`   | Small administrative change history                                                     |

- Verified school identities may apply without a permission role. Provider identifiers are unique; email is contact data, never a relational key. Nullable provider identifiers support historical imports before account reconciliation.
- Admin access is explicit, independent of membership and public titles. The verified club account receives an audited explicit admin grant; designated leaders require explicit admin assignment. The schema does not infer authority from a matching email or title.
- A member grant gives access during active or paused membership. Former members lose member access; an independent admin grant still works. Disabled or unverified identities have neither access.
- One open application per identity (`submitted` or `under_review`) is enforced by a partial unique index. Rejection and withdrawal permit immediate reapplication unless a separate dated restriction applies. Active/paused members cannot submit again.
- Applications move from submitted to under review or a terminal state; under review may become accepted, rejected, or withdrawn. Terminal states cannot reopen. Owners may withdraw; admins review. Acceptance uses `applications.accept`, which atomically writes the reviewed member card, active state, explicit member grant, accepted association, and history. Concurrent retries return the same membership without changing the card.
- Imported memberships need no application. Rejoining associates another application with the same membership, preserving attendance. Its new start must follow existing history. Future start dates are allowed; access begins on that date.
- Private notes have a separate table and an authorized admin read operation. Roster views omit them. The default roster is `members.active_roster`; `current_roster` supports paused/former filters.
- A manual grade correction updates the grade/year baseline. Grade progression derives from that baseline at August 1 in Tokyo. A derived graduated grade does not silently change membership status.

## Dates and attendance

Date ranges use **inclusive start, exclusive end**. Academic years run August 1 through the next August 1; terms fit within them and cannot overlap within the same year, making current-year/term selection unambiguous. Sessions may overlap. Imported sessions may remain unassigned to a term, while retaining a required academic year; admins configure actual term dates and assign sessions through `src/sessions/calendar.ts`. Normal session input still requires a term. A session must start within its academic year and, when assigned, its term and last 1-1440 minutes; it may end the following day.

Membership state changes take effect for the entire Tokyo calendar date. Before the first state change there is no membership eligibility. One change per member/date prevents conflicting same-day states; later dates define pauses, departures, and rejoins without deleting history. Retroactive changes recalculate historical eligibility deliberately.

Sessions store a Tokyo-local `timestamp without time zone`; `meetings.session_times` derives actual `timestamptz` start/end values explicitly using `Asia/Tokyo`. Keep local date/time inputs as strings and bind through `::text::date` or `::text::timestamp`; do not let a driver convert them through JavaScript `Date` and the host timezone. Use timestamps with offsets for actual instants.

`meetings.eligible_attendance(member, as_of)` selects completed, scheduled sessions whose Tokyo start date falls in an active membership period. It excludes cancelled/future/in-progress sessions, pre-join sessions, paused periods, and departure-to-rejoin gaps. The pure `attendanceSummary` function owns the percentage calculation:

- Numerator: present + late.
- Denominator: present + late + unexcused absence.
- Excused absence is excluded. Missing records and explicit unmarked records stay pending, never automatic absences.
- An empty denominator returns `null` (no percentage yet), rather than claiming perfect attendance.

One attendance record per member/session is enforced in PostgreSQL. Admin corrections upsert and record status history. Absence notices do not set attendance. A notice either references a session (date derived from the session) or records a standalone date for legacy notices without a session.

## Integration boundaries

Operations take a trusted actor identity from the single server current-user lookup. Never accept that identity from request bodies or expose SQL functions as public RPCs. Functions use invoker rights; PUBLIC function/table privileges are revoked. The trusted application boundary enforces authorization rather than exposing public SQL RPCs. A restricted runtime group is defined in `db/runtime-role.sql` and exercised in local request tests.

Google sign-in verifies signed provider claims and the school domain before marking an identity verified. Hosted Neon Auth remains separate; application migrations never recreate provider tables. Real provider sign-in/linking remains unverified.

Session materials store a specific Google Drive folder URL only. Folder provenance (materials, not internal reports) must be checked by the admin attaching it; a URL cannot prove that distinction. Membership grants no Drive permission. No Drive APIs or credentials are used. Stories accept an empty description; keep legacy image upload-on-save when reusing the frontend. Image bytes remain in PostgreSQL with a 2 MiB cap.

See [migration guidance](docs/migration.md) for the isolated, credential-free `db:rehearse` command before importing existing records. Data import, real Google sign-in verification, frontend integration, deployment, and domain changes remain separate work.

## Run the backend

Copy `.env.example` to `.env.local` and fill development settings. Run `npm run dev`; use `npm run build` for a production compilation. No deployment is needed to run locally. See [request interfaces and Auth setup](docs/api.md) for routes, revision tokens, image saves and remaining provider verification.

## Frontend

The homepage uses the existing public content operations for announcements and term focus. Empty records and unavailable reads have distinct states; the latest completed session’s title/description and the current term’s non-cancelled session titles are public. Dates, locations, materials, attendance, and other session details remain behind the member/admin authorization boundary. No legacy programme fallback is used. Meetings uses this same public title-only programme. Story presents the club’s history as an oldest-first timeline of published Story milestones, including entries without a description. It never derives milestones from session records, and distinguishes empty content, unavailable reads, and image failures.

Typography uses Montserrat for headings, Lato for body text and controls, and JetBrains Mono for mathematical/code content. Keep fonts FOSS; all three use SIL OFL 1.1, with notices retained in `LICENSES/`. `next/font` self-hosts the selected fonts.

### Frontend review and next phase

Privacy and Members are public information pages. The Members page is an access entry point and does not read or expose private account data.

Step 5 is the protected frontend phase: sign-in and real authentication verification, applications and status tracking, the member dashboard, and the leadership control panel. The recurring meeting day, time, and room editor also requires the deferred backend support. These workflows remain outside the public-page implementation.

The public Members page introduces people through published leadership profiles, without joining private identity or membership records. Verified legacy copy supplies the governance introduction; missing named profiles are left empty. Protected member services require a separate destination in Step 5. Privacy describes implemented backend records and access rules, without promising retention periods, automatic deletion, or verified live authentication. Retention duration, deletion handling, and the process for approving public profiles need policy confirmation before member services launch.

ASCII foreground scenes use the right side of desktop heroes independently of the background surface. Only the landing page enables the full-hero wave surface.
