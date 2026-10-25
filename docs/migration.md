# Importing the legacy database

The initial migrations create a new database; they do not transform production in place. Keep the verified private backup outside Git. The rehearsal command below implements the mapping against a fresh, isolated local database. It cannot target production and is not a cutover command.

## Mapping

| Legacy source                         | New destination and treatment                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `people.application_identities`       | `people.identities`: preserve identity UUIDs and Google subjects; map `neon_auth_user_id` only after hosted Auth reconciliation. Map enabled/verified flags conservatively from active affiliation evidence.                                                                                          |
| `people.technical_access_assignments` | Explicitly reviewed `people.role_grants`. Do not automatically translate `basic`, `operator`, or `access_admin` into club permission roles. Seed the verified club account and approved leaders as admins.                                                                                            |
| `applications.student_applications`   | `applications.submissions`: preserve UUID, identity, answers, status reason, reviewer, and timestamps. `reviewing` → `under_review`; `declined` → `rejected`. Parse numeric grade and supply its academic year. Nullable course/interest answers remain valid for older submissions.                  |
| `members.club_members`                | `members.memberships`, `private_notes`, `state_changes`: preserve UUIDs where there is one membership per identity. Link accepted applications through `submissions.member_id`; membership itself needs no application.                                                                               |
| `meetings.club_sessions`              | `meetings.sessions`: preserve UUID, title, location, notes, and created time. Parse session date + start time as Tokyo-local values; derive duration from end time. Assign the August-based academic year; leave the term unassigned until admins configure real dates. Keep all historical sessions. |
| `meetings.session_attendance`         | `meetings.attendance`: preserve member/session links, statuses, notes, recorder, and update time. Existing categories match exactly. Ledger UUIDs can be retained in the private import mapping; the new natural primary key is member/session.                                                       |
| `meetings.expected_absences`          | `meetings.absence_notices`: retain UUID, reason, status, actor, and created time. Linked notices store session ID and no duplicate date; unlinked notices retain their date.                                                                                                                          |
| `content.images`                      | `content.images`: retain UUID, bytes, MIME, alt text, dimensions, uploader, created time. Validate stored byte count against actual bytes.                                                                                                                                                            |
| `content.announcements`               | Same conceptual model. `published=false` maps to null publication time; published rows retain their time. Keep image UUIDs.                                                                                                                                                                           |
| `content.story_entries`               | `content.stories`: `body` → `description`, `occurred_on` unchanged; empty descriptions remain empty. Preserve image UUIDs, publication flag, and original timestamps.                                                                                                                                 |
| `content.club_resources`              | `content.resource_links`: preserve IDs, ordering, descriptions, and HTTPS URLs.                                                                                                                                                                                                                       |
| Frontend leadership/club information  | No public leadership profiles are inferred from Auth users or technical roles. Backed-up Google profile photos import as binary `content.images`, linked through `people.identities.profile_image_id`. Frontend leadership/club information remains a separate reviewed source-content task.          |
| `members.member_warnings`             | Preserve as `operations.change_history` events (`membership.warning_issued` / `membership.warning_resolved`), targeting the member and including original warning UUID, text, active/resolved dates, and issuing/resolving actor. No automated warning system is introduced.                          |

## Reconcile before loading

- Preserve both legacy `display_name` and `roster_name` during name reconciliation: select the reviewed display name and retain any different administrative roster name in private notes/history, with the original source retained in the private mapping.
- Multiple legacy membership records may share an identity. Choose one canonical membership UUID, retain an explicit private old→new mapping, and remap applications, attendance, absence notices, warnings, and profile references together. Conflicting attendance for a merged member/session needs review; do not silently overwrite it.
- Legacy `inactive` does not prove whether someone paused or left. Review it, as well as the departure reason for former members. Convert `joined_at`/`left_at` to Tokyo dates. Recover additional state dates from trustworthy history where available. Missing pause/rejoin history cannot be reconstructed from current status alone: report gaps and withhold affected percentages until reviewed.
- Resolve `grade_override` with `cohort_year` and applied grade. A numeric override becomes an explicit grade/year baseline at the reviewed observation date; a graduated override requires a reviewed departure date. Do not infer removal or graduation solely from a title or age.
- Legacy accepted applications may lack memberships because acceptance was not atomic. Reconcile each against membership and identity records; create an approved historical member card or correct the legacy inconsistency before import. Never create a fictitious new application for an imported member.
- Academic years/terms were absent from the legacy session model. Academic years derive from the agreed August 1 rollover; term dates remain admin-configurable. Imported sessions may await term assignment. Flag invalid times, duplicate dates/records, and sessions outside a term rather than guessing a curriculum structure. Duplicate or overlapping sessions are allowed if they are distinct events.
- Convert nonempty `drive_folder_id` to `https://drive.google.com/drive/folders/<id>` only after confirming it is a materials folder. Omit unverified/internal report links and retain them only in the private reconciliation mapping. Website records cannot establish Drive access.
- Reconcile duplicate live absence notices, image metadata, invalid dates, missing actors, and rejected constraints explicitly. Keep source mappings and reconciliation output private.

## Loading and verification

Run with Node.js and PostgreSQL 18 tools on PATH, as a normal user:

```sh
npm run db:rehearse -- --backup /private/backup --output /private/rehearsal --decisions /private/decisions.json
```

The runner checks backup checksums, starts a private Unix-socket-only cluster, restores the native archive, and compares typed source rows against every CSV using `EXCEPT ALL` in both directions. Generated archive dates are checked separately because PostgreSQL COPY excludes generated columns. It creates a new target database, applies migrations, imports in one transaction, verifies transformed fields and relationships, dumps the result, restores it to another new database, and repeats verification. It then stops and removes the temporary cluster. The output directory contains a private report, ID mapping, and target dump. Keep the output and decisions outside Git; the runner refuses output within a repository or overlapping the backup. Do not execute untrusted database archives or restore-role scripts.

Private decisions use this shape (use real reviewed UUIDs only in the private file):

```json
{
  "preserveRecordedJoinDates": true,
  "formerReasons": {},
  "absenceSessionOverrides": {},
  "terms": [],
  "approvedAdminIdentityIds": [],
  "approvedMaterialsFolders": []
}
```

`formerReasons` maps membership UUIDs to `quit`, `removed`, or `graduated`. `absenceSessionOverrides` maps a mismatched notice UUID to an approved session UUID or null to preserve its original date without a link. Term entries require `id`, `academicYear` (start year), `name`, `startsOn`, and exclusive `endsOn`. Admin grants require explicit reviewed identity UUIDs; technical roles do not imply club roles. Materials-folder approval lists specific folder IDs after provenance review. The current importer intentionally fails on unhandled duplicates, ambiguous membership states/times/grades, missing associations, unresolved absence links, and nonempty warnings rather than inventing transformations. Extend and test it before using a different source shape.

The runner ignores database URL/environment credentials and cloud CLI context. Hosted Auth tokens, sessions, keys, passwords, and provider configuration never enter the target or import plan. Legacy user IDs are retained only in the private mapping; immutable Google subjects and backed-up profile-image relationships are verified before import. No Auth provider tables are installed in the new database. All provider tokens remain confined to the protected source restore until the temporary cluster is removed.

Attendance verification compares exact eligible session IDs against an independent source calculation at the frozen backup snapshot, then checks numerator, denominator, percentage, membership access, pre-join/departure exclusions, and pending records. Ledger rows outside membership are retained and flagged. Affected percentages in the private report are withheld; any calculated previews are labeled explicitly. Unassigned terms and other unresolved findings block cutover; they do not require guessed calendar values.

Only `applications.submissions`' initial-submission trigger is disabled inside the dedicated import transaction, allowing historical accepted/rejected rows. Foreign keys and checks remain active; the trigger is restored before commit and verified afterward. The profile-image foreign key is deferred until commit to allow the identity/image reference cycle. No ordinary application operation gains an import bypass.

Preserve IDs where possible, then load identities, academic years/terms, memberships and state history, applications, sessions, attendance/notices, images/content, and approved roles. Application insertion normally enforces a new submission. The rehearsal uses the transaction-scoped path described above; a production import would still require a separately reviewed cutover procedure.

Compare counts and content hashes against the source with explicit allowances for merged rows and transformed fields. Verify every relationship through the ID mapping, image byte hashes, application/member identity matches, unique attendance, history dates, and representative attendance calculations. Repeat restore/import validation before any cutover is proposed. Rehearsals operate on private local copies; no production database is changed.

Keep legacy affiliation/audit records in the private archive; selectively carry useful administrative events into the small history table. Infrastructure probes, durable queues, synthetic mutations, retry machinery, and provider configuration do not need active equivalents.

`neon_auth` records in the backup are evidence for reconciliation, not a portable hosted Auth configuration. Preserve stable Google subjects; establish how the new hosted instance maps its user IDs before linking accounts. Never blindly restore provider-managed tables into a newly configured hosted Auth instance. Vercel/Neon CLI login alone does not establish club ownership or deployed credentials. Google Cloud ownership and OAuth approval remain unresolved; this import needs no Drive API.
