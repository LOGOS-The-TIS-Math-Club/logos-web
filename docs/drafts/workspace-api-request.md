# Draft: Google Workspace API request

> Status: Draft for club leadership to review and send. Not sent.
> Recipient: Tokyo International School IT
> Related: docs/school-it-requests.md item 1 and item 5

**Before sending**, please check two things:

1. `mathclub@tokyois.com` needs to be a real Workspace **account**, not a group
   or an alias. A group cannot own a Google Cloud project or hold API
   credentials, so the whole request depends on this.
2. Put your name at the bottom, and remove any of the three uses below that the
   club does not actually want. Asking for less is easier to grant.

---

**Subject:** Request: Google Workspace API access for mathclub@tokyois.com

Dear IT Team,

I am writing on behalf of LOGOS, the student mathematics club, about our club
website.

We would like to request Google Workspace API access for the club account,
`mathclub@tokyois.com`, scoped to that account's own Drive folders and to our
club's Google Classroom. There are three things we would use it for.

**1. Keeping folder access in step with membership.** When a student is
approved as a member, we would like their school email address to be added
automatically to the view permissions on our shared Drive folder, and removed
when they leave the club. At the moment this is maintained by hand, so it drifts
out of step with the actual membership list.

**2. Backing up the club's records.** Our website stores the membership list,
meeting attendance and applications. We would like it to write a regular backup
of that data to a folder in the club's own Drive, so the records survive a
change of leadership or a problem with the hosting provider. Nothing would be
written anywhere except that one folder.

**3. Showing session materials on the website.** Each weekly session would point
at a folder in the club Drive, and the website would list the files in it for
signed-in members. The files themselves would stay in Drive under the school's
existing permissions — the website would show only their names and links, and a
student who cannot open a file in Drive would not be able to open it from the
website either.

To be clear about the limits of what we are asking for:

- Access would be confined to Drive folders owned by the club account and to
  the club's own Classroom. No other school data would be reachable.
- Permission changes would only ever apply to verified `@tokyois.com` addresses
  of approved club members.
- No student data would leave school systems. The backup writes into school
  Drive; it does not send anything to a third party.
- Any of the three uses can be granted on its own if some are acceptable and
  others are not.

We are happy to go through the setup with you, to use a service account or
delegated access if you would prefer that, or to adjust the approach entirely if
there is a method the school would rather we use. Please let us know if it would
help to discuss this in person.

Thank you for your time.

Kind regards,
[Your name]
LOGOS — Tokyo International School Math Club
