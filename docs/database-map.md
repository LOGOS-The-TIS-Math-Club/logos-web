# Database map

The live PostgreSQL database is `neondb`. A schema is a named category of
tables. The application owns six category schemas; `logos` retains shared SQL
functions and enum types. Neon Auth owns `neon_auth`, Drizzle owns `drizzle`, and
PostgreSQL's `public` schema may contain provider-created examples.

| Schema         | Purpose                                                    | Tables                                                                                                          |
| -------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `people`       | Website identity, school affiliation, and technical access | `application_identities`, `affiliation_evidence`, `technical_access_assignments`, `access_bootstrap_state`      |
| `applications` | Requests to join the club                                  | `student_applications`                                                                                          |
| `members`      | Club roster and member warnings                            | `club_members`, `member_warnings`                                                                               |
| `meetings`     | Planned sessions and attendance                            | `club_sessions`, `expected_absences`, `session_attendance`                                                      |
| `content`      | Website notices, history, links, and uploaded pictures     | `announcements`, `story_entries`, `club_resources`, `images`                                                    |
| `operations`   | Rate limits, audits, retries, and migration checks         | `rate_limits`, `business_audit_journal`, `security_audit_journal`, `durable_operations`, `infrastructure_probe` |

The main path is **Neon Auth user → `people.application_identities` →
`applications.student_applications` → `members.club_members`**. A person can
sign in without being a club member. `people.technical_access_assignments`
controls website permissions separately from club membership.

`meetings.expected_absences` is a member's advance notice;
`meetings.session_attendance` is leadership's final attendance record. Content
rows can refer to `content.images`. Audit journals record changes, not a second
copy of the main records.

## Maintenance rules

- Edit club information through the website's admin pages. Avoid editing live
  rows directly in the Neon SQL editor.
- Change table structure in `db/schema.ts` and a committed `drizzle` migration
  together. Never rename or delete a live table directly in Neon.
- Leave `neon_auth` and `drizzle` tables to their owning systems. Empty tables
  can be valid placeholders for implemented features.
- The category migration uses `ALTER TABLE ... SET SCHEMA` so existing rows,
  indexes, foreign keys, and table grants remain attached to each table.
