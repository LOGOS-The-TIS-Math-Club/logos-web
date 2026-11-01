# Backend request interface

Next.js serves the backend at `/api`; the homepage reads published announcements and club information through the same content operations. Feature operations live under `src/` and take the internal actor ID only from `getCurrentUser`. They are server modules, never browser RPCs. SQL migrations remain the model source of truth.

Responses are `{ data: ... }` or `{ error: { code, message, requestId, fields? } }`. All API reads use `Cache-Control: no-store, private`; attendance is never served from a shared cache. Errors distinguish unauthenticated (401), denied (403), missing/hidden record (404), stale/duplicate change (409), invalid data (400/422), oversized upload (413), and infrastructure failure (503). Internal SQL/provider errors are not returned. Server failure logs contain a request ID, error type and code, without payloads or tokens.

Every mutation requires the exact `APP_URL` Origin; request bodies use JSON content type. Requests use same-origin credentials. A future form should keep the returned integer `revision` and send it on edits; a conflict requires a reload/review, not a silent retry overwriting newer data. Acceptance is deliberately retry-safe after success, returning the original membership.

## Routes

| Method and path                                                                | Behavior                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `GET /api/me`                                                                  | Current stable identity and effective admin/member flags; an applicant has neither flag                           |
| `GET, POST /api/me/applications`                                               | List own applications / submit existing application input fields                                                  |
| `GET /api/me/applications/:id`                                                 | Own complete answers and status; no internal review notes                                                         |
| `POST /api/me/applications/:id/withdraw`                                       | `{revision}`                                                                                                      |
| `GET /api/me/membership`                                                       | Own card, application answers and attendance summary                                                              |
| `GET /api/me/attendance`                                                       | Eligible individual records and settled percentage calculation                                                    |
| `GET, POST /api/me/absences`                                                   | List notices / create `{sessionId, reason}` or `{sessionDate, reason}`                                            |
| `POST /api/me/absences/:id/cancel`                                             | `{revision}`                                                                                                      |
| `GET /api/calendar`                                                            | Current Tokyo academic year/term and sessions; null when unconfigured                                             |
| `GET /api/sessions`                                                            | Upcoming scheduled sessions; optional `academicYearId` or `termId` filter                                         |
| `GET /api/sessions/:id`                                                        | Same session record for admins and members, calculated start/end instants                                         |
| `GET /api/admin/applications?status=submitted`                                 | Review queue (`all` supported)                                                                                    |
| `GET /api/admin/applications/:id`                                              | Full review detail with restrictions separately identified                                                        |
| `POST /api/admin/applications/:id/status`                                      | `{revision, status: "under_review" \| "rejected", reason?}`                                                       |
| `POST /api/admin/applications/:id/accept`                                      | `{revision, memberCard: {displayName, grade, gradeAcademicYear, startsOn, privateNotes}}`                         |
| `GET /api/admin/members?status=active`                                         | Explicit `active`, `paused`, `former`, `all` filters                                                              |
| `GET, PUT /api/admin/members/:id`                                              | Private detail / `{revision, displayName, grade, gradeAcademicYear, privateNotes}`                                |
| `POST /api/admin/members/:id/state`                                            | `{revision, effectiveOn, status, departureReason?}`; former requires a reason                                     |
| `POST /api/admin/identities/:id/grant-admin`                                   | Explicit grant; never inferred from leadership profile                                                            |
| `POST /api/admin/identities/:id/revoke-admin`                                  | Explicit revocation; preserves the final enabled admin                                                            |
| `POST /api/admin/identities/:id/restrictions`                                  | Separate `{reason, startsAt?, endsAt?}` reapplication restriction                                                 |
| `POST /api/admin/restrictions/:id/end`                                         | End a current indefinite restriction                                                                              |
| `GET, POST, PUT /api/admin/academic-years`                                     | List/create/edit; create has `{id, name, startYear, startsOn, endsOn}`; edit adds revision                        |
| `GET, POST, PUT /api/admin/terms`                                              | List/create/edit; `{id, academicYearId, name, startsOn, endsOn, revision?}`                                       |
| `POST /api/admin/sessions`                                                     | `{id, termId, date, startTime, durationMinutes, title, description?, materialsFolderUrl?, status?}`               |
| `PUT /api/admin/sessions/:id`                                                  | Same session fields plus revision; status changes use cancel                                                      |
| `POST /api/admin/sessions/:id/cancel`                                          | `{revision}`; attendance history remains                                                                          |
| `GET /api/admin/sessions/:id/attendance`                                       | Takes session ID; returns sessionId, sessionRevision, date-eligible roster, stored marks and notices              |
| `PUT /api/admin/sessions/:id/attendance`                                       | `{revision, records: [{memberId, status, notes?}]}`; all records commit together                                  |
| `GET /api/admin/absences`                                                      | All linked and standalone notices, including paused/former members                                                |
| `POST /api/admin/absences/:id/acknowledge`                                     | `{revision}`                                                                                                      |
| `GET /api/public/{stories,announcements,leadership,resources,club-info}`       | Published content; admins must explicitly publish resource links before they appear publicly; club info is public |
| `GET /api/public/images/:id`                                                   | Binary image only when referenced by published content                                                            |
| `GET, POST /api/admin/content/{stories,announcements,leadership,resources}`    | List drafts/create                                                                                                |
| `GET, PUT /api/admin/content/{stories,announcements,leadership,resources}/:id` | Load/edit with revision                                                                                           |
| `GET, POST, PUT /api/admin/content/club-info`                                  | Singleton load/create/edit                                                                                        |
| `POST /api/admin/content/images`                                               | `{requestId, upload: {base64, mimeType, altText}}` for a validated standalone image                               |
| `GET /api/admin/content/images/:id`                                            | Private image preview                                                                                             |

Imported resource links default to unpublished and stay available in admin detail until reviewed. Publishing a resource is an explicit admin edit.

All `POST /api/admin/content/*` creates require a UUID `requestId` in the JSON body, including club-info and standalone images. Generate it with `crypto.randomUUID()` once when starting a logical save. Retain that ID together with the submitted fields and selected image bytes until the result is known; use the same ID and payload after a timeout, lost response, or retry. Generate a new ID for a separate creation or changed payload, even when its title/date matches another Story. PUT edits keep their revision contract and need no requestId.

Replay IDs are scoped to the authenticated actor and operation. An identical retry returns `201` with the original JSON result (including its original ID, image ID, revision and timestamps), even if that content has subsequently been edited. Use GET to load the current record. A valid but different payload under an already committed ID returns `409 CONFLICT`; fingerprints cover validated fields plus upload MIME, alt text and a hash of the actual bytes. Object-key order and schema defaults do not change the fingerprint. A failed validation or rolled-back transaction consumes no ID, so a corrected retry can use it; once committed, changed input requires a new ID. Permissions are rechecked for every retry. Do not automatically discard receipts: they preserve replay safety across process restarts and database restoration.

Content inputs are defined in `src/content/input.ts`. Stories require title/date, allow no description, and optionally reference an existing image. Resource links default to unpublished and require an explicit `published: true` admin edit before appearing publicly. A Story or announcement Save can include `upload: {base64, mimeType, altText}`; omit imageId when uploading. Image and content writes share a transaction. A failed save leaves no orphan upload; keep the selected file and user edits in frontend state so retry is possible. Allowed raster types: JPEG, PNG, WebP, GIF; up to 2 MiB encoded bytes, 16,777,216 decoded pixels and 8192 per side. Corrupt data and mismatched MIME are rejected by full decoding. Image bytes stay in PostgreSQL.

Session times are Tokyo local `YYYY-MM-DD` and `HH:mm`. Ranges use exclusive ends. Materials accept specific HTTPS Google Drive folder links, including account-index links. An absent link means materials are not added. Saving a link does not verify its contents or grant Drive access; admins must attach only reviewed materials folders. This backend uses no Drive credentials or API.

Published story and announcement responses include optional image alt text and dimensions (`image_alt`, `image_width`, `image_height`). They do not include image bytes or uploader identity; render images through the authorized public image route.

## Attendance selection and edits

Read and write `/admin/sessions/:id/attendance` with the selected session's ID. The response repeats `sessionId`; reject a response if it no longer matches the active selection. Abort old requests or track a request sequence. Reset selection-local roster and modal state when the selected session changes. The legacy code's old URL-only selection could retain the previous roster in React state; that is separate from backend caching. The new request tests cover A → B reads and save → reread, not the future UI interaction.

The roster uses membership state on that session's Tokyo date. Existing out-of-period attendance remains visible with `eligible: false` and can be corrected, but no new out-of-period record can be added. Cancellation preserves records and excludes them from percentages. Paused/pre-join periods and pending/excused marks follow the existing eligibility/percentage policy. Attendance edits lock the session and compare its revision, preventing competing batches from silently overwriting each other.

## Authentication and configuration

Use the single Neon Managed Better Auth SDK integration. The browser should use `createAuthClient()` from `@neondatabase/auth/next`, then `signIn.social({provider: "google", callbackURL: "/auth/complete"})`, `getSession()` and `signOut()`. The SDK proxy on `/auth/complete` exchanges the OAuth verifier; the completion route associates the stable internal identity. The auth proxy exposes only Google sign-in/linking, session lookup and sign-out. The application accepts neither email/password-only sessions nor client-supplied roles/identity IDs.

`getCurrentUser` validates a fresh hosted session (bypassing SDK cookie cache), reads the linked Google provider account and checks enabled school identity/roles on every request. Initial association or email change requires a Google-signed ID token with the exact configured audience, valid issuer/expiry, verified school email and hosted domain. Later sessions must still match the stored Google subject and email. Multiple Google links, conflicting identities, or ambiguous imported emails require reconciliation; no records are silently merged. Provider tables are read only. The verified club account receives an explicit audited admin grant; leaders must receive an explicit admin grant separately.

Set `APP_URL`, pooled runtime `DATABASE_URL`, branch `NEON_AUTH_BASE_URL`, locally generated `NEON_AUTH_COOKIE_SECRET` (32+ characters), and the exact `GOOGLE_OAUTH_CLIENT_ID`. Keep environment values outside Git. Never use old connector/CLI identity as evidence of deployed credentials. Deployments need their own correctly scoped variables, hosted trusted origin, and club-owned Google OAuth client settings. Run migrations as owner with a direct URL; after hosted Auth exists, apply `db/runtime-role.sql` and grant the `logos_runtime` group to a dedicated application login. Reapply grants after migrations add new relations/functions. Tests exercise request operations under this non-owner group and verify it cannot mutate Auth or create tables.

Live Google sign-in, provider linking and session restoration must still be exercised by a human on the selected branch. The local Auth fixtures are synthetic contract tests, not evidence of real OAuth success. The current club CLI confirms project ownership/admin access and hosted Better Auth with shared Google development credentials; Google Cloud IAM access remains unavailable, and no production trusted origin or Vercel project is configured. No remote configuration was changed during implementation.

Provider references: [Neon Next.js API setup](https://neon.com/docs/auth/quick-start/nextjs-api-only) and [Google OAuth configuration](https://neon.com/docs/auth/guides/setup-oauth). The installed SDK is the authority for the cookie TTL and route-handler signatures used here.

## Public homepage session summary

The server-rendered homepage also calls `getPublicSessionSummary` in `src/sessions/public.ts`. It returns only the latest completed, non-cancelled session’s title and description, plus every non-cancelled session title in the current Tokyo term in chronological order. An unconfigured term (`null`), an empty programme (`[]`), and an unavailable read are distinct states. This is a narrow public projection of the same session records; authenticated calendar endpoints retain their existing permissions and full session details. No materials, location, attendance, identity, or administrative fields are returned.
