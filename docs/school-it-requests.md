# School IT and administration requests

> - Status: Open list, maintained as needs arise
> - Owner: LOGOS student leadership
> - Purpose: everything that needs Tokyo International School IT or
>   administration to grant, delegate, or approve — collected in one place so it
>   can be raised in a single conversation rather than piecemeal.

Nothing on this list can be done by the development work alone. Each item needs
a person at the school to act.

## 1. Club mailbox — `mathclub@tokyois.com`

**Why.** Club infrastructure is currently tied to personal accounts and a
personal Google Cloud project. That is not sustainable across leadership
handovers: when a founder graduates, whoever holds the account holds the club's
website, database and sign-in configuration.

**Ask.** A Google Workspace group or shared mailbox at `mathclub@tokyois.com`,
with club leadership as owners and the ability to transfer ownership to the next
leadership team.

**Blocks / unblocks.**

| Currently                                             | After the mailbox exists                              |
| ----------------------------------------------------- | ----------------------------------------------------- |
| Public contact is "come to Room 101 on a Friday"      | A real contact address can be published               |
| Application replies come from a personal account      | Replies come from the club                            |
| `GMAIL_SENDER` in `.env.example` is unset             | Automated application notifications become possible   |
| Google Cloud OAuth client lives in a personal project | The OAuth client can be moved to a club-owned project |

**Follow-on work once granted**, in order:

1. Create a Google Cloud project owned by the club mailbox.
2. Recreate the OAuth 2.0 Web client there (see `docs/phase-04.md` for the
   identity model). Keep the authorized redirect URI pointing at Neon Auth.
3. Update `GOOGLE_OAUTH_CLIENT_ID` in Vercel and the client ID/secret in the
   Neon Auth Google provider. These must match — the app verifies Google's ID
   token against this exact client ID.
4. Publish the contact address on `/about` and in the footer.
5. Only then consider enabling Gmail sending, which is production-only and
   separately revocable.

**Care required.** Changing the OAuth client invalidates existing sessions and,
if the two sides disagree, silently leaves every genuine `@tokyois.com` student
stuck on "Account Verification Required". Do this deliberately, verify with a
test account, and keep the old client until the new one is confirmed working.

## 2. Domain and DNS

**Ask.** Confirmation of who controls `tislogos.org` and whether the school
wants it, or a `*.tokyois.com` subdomain, to be the canonical address long term.

**Why.** If the club site should eventually live under the school domain, that
decision affects the OAuth redirect URIs, the canonical `APP_URL`, and every
printed poster. Better to know before the next poster run.

## 3. Poster and public communication approval

**Ask.** Confirmation of who signs off public-facing club material, and whether
the website counts as school communication for that purpose.

**Why.** The site publishes the club's founding date, purpose and values from
the charter. If any of that needs administrative review before publication, we
should know which office does it.

## 4. Student photography and consent

**Ask.** The school's policy for publishing photographs of students on a
club-run public website, and where consent records live.

**Why.** The legacy Drive folder contains session photographs that would improve
the site considerably. None are used today, precisely because consent has not
been established. This stays blocked until the policy is clear.

## 5. Google Workspace scopes — only if the dashboard is revived

Not needed today. Listed so the cost is visible before anyone commits to the
member dashboard described in `docs/roadmap-compaction.md`.

- A service account, or delegated access, able to read the specific Drive files
  the club wants members to download.
- Read access to the club's Google Classroom course, if classwork is ever to be
  surfaced on the site.
- A shared Google Calendar for meeting dates.

Each of these widens the amount of student data the site touches, so none should
be requested until the dashboard is actually being built and the privacy
boundary has been re-reviewed.

## How to raise these

Group them. IT is far more likely to act on one clear request covering the
mailbox, the domain question and the photography policy than on three separate
messages. Items 1 and 2 are the ones that matter for sustainability; 3–5 can
wait until they are actually needed.
