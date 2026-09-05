# Draft: Google Workspace API request

> Status: Draft for club leadership to review and send. Not sent.
> Recipient: Tokyo International School IT
> Related: docs/school-it-requests.md item 1 and item 5

**Before sending**, please check two things:

1. `mathclub@tokyois.com` needs to be a real Workspace **account**, not a group
   or an alias. A group can't own a Google Cloud project or hold API
   credentials, so the whole request depends on this.
2. Put your name at the bottom, and delete any of the three things below that
   the club doesn't actually want. Asking for less is easier to say yes to.

---

**Subject:** Question about Google Drive access for the maths club account

Dear Mr / Ms [Name],

I'm a student at TIS and I help run LOGOS, the school's maths club. We've built
a website for the club, and I wanted to ask about something before we go any
further with it, because I don't think it's a decision we should make on our
own.

We'd like the website to be able to use the club's Google account,
`mathclub@tokyois.com`, to do three things with the club's own Drive folder:

**1. Keep folder access matching our member list.** Right now, when someone
joins the club, we add them to the shared folder by hand. We forget, and people
end up locked out or still having access after they've left. If the website
could do it, the folder would just stay correct.

**2. Save a backup of our records.** The website stores our member list,
attendance and applications. Everyone running the club right now graduates
eventually, and the website is hosted on an account the school doesn't own. If
it saved a copy into the club's Drive each week, none of that would be lost when
we leave.

**3. Show session materials to members.** Each weekly session would link to a
folder, and members could see the handouts for that week when they sign in.

I realise asking for API access sounds like a lot, so to be clear about what it
would and wouldn't cover:

- Only the club's own Drive folder. Nothing else in the school's Drive would be
  reachable.
- It would only ever add or remove people using verified `@tokyois.com`
  addresses of students we've accepted into the club.
- Nothing gets sent outside school systems. The backup is written into school
  Drive, not to anywhere else.
- Any one of the three would be useful on its own, so please feel free to say
  yes to some and no to others.

I completely understand if this isn't something the school can do, or if there's
a safer way you'd rather we went about it — we'd be happy to do it whichever way
you prefer. I'm also happy to come and explain what we've built and show you the
site, if that would be easier than going back and forth over email.

Thank you very much for your time.

Best regards,
[Your name]
Grade [ ] — LOGOS Maths Club
