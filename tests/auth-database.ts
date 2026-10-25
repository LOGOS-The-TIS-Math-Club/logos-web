import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { ZodError } from "zod";
import { hasAccess } from "../src/access/operations.ts";
import { associateGoogleIdentity, createCurrentUser } from "../src/auth/current-user.ts";
import { googleClaims } from "../src/auth/google.ts";

type Claims = { sub: string; email: string; email_verified: true; hd: "tokyois.com" };

function claims(email: string, label = randomUUID()): Claims {
  return { sub: `google-${label}`, email, email_verified: true, hd: "tokyois.com" };
}

export async function verifyAuth(sql: postgres.Sql) {
  // This is a test-only stand-in for Neon Auth's provider-owned table. The test cluster is disposable.
  await sql`create schema if not exists neon_auth`;
  await sql`create table if not exists neon_auth.account (
    id text primary key,
    "userId" text not null,
    "providerId" text not null,
    "accountId" text not null,
    "idToken" text
  )`;

  const suffix = randomUUID();
  const expectCode = async (promise: PromiseLike<unknown>, code: string) => {
    await assert.rejects(Promise.resolve(promise), (error: unknown) => (error as { code: string }).code === code);
  };

  const importedEmail = `imported-${suffix}@tokyois.com`;
  const [imported] = await sql`insert into people.identities(email,school_verified)
    values (${importedEmail},false) returning id`;
  const importedClaims = claims(importedEmail, `import-${suffix}`);
  const importedId = await associateGoogleIdentity(sql, `auth-import-${suffix}`, importedClaims);
  assert.equal(importedId, imported.id);
  assert.equal(await associateGoogleIdentity(sql, `auth-import-${suffix}`, importedClaims), imported.id);
  assert.equal((await sql`select count(*)::int as n from people.identities where lower(email)=${importedEmail}`)[0].n, 1);

  const concurrentEmail = `concurrent-${suffix}@tokyois.com`;
  const concurrentClaims = claims(concurrentEmail, `parallel-${suffix}`);
  const concurrentUser = `auth-parallel-${suffix}`;
  const [concurrentA, concurrentB] = await Promise.all([
    associateGoogleIdentity(sql, concurrentUser, concurrentClaims),
    associateGoogleIdentity(sql, concurrentUser, concurrentClaims),
  ]);
  assert.equal(concurrentA, concurrentB);
  assert.equal((await sql`select count(*)::int as n from people.identities where lower(email)=${concurrentEmail}`)[0].n, 1);

  const disabledEmail = `disabled-${suffix}@tokyois.com`;
  await sql`insert into people.identities(email,enabled) values (${disabledEmail},false)`;
  await expectCode(associateGoogleIdentity(sql, `auth-disabled-${suffix}`, claims(disabledEmail)), "FORBIDDEN");

  const ambiguousEmail = `ambiguous-${suffix}@tokyois.com`;
  await sql`insert into people.identities(email) values (${ambiguousEmail}),(${ambiguousEmail})`;
  await expectCode(associateGoogleIdentity(sql, `auth-ambiguous-${suffix}`, claims(ambiguousEmail)), "IDENTITY_CONFLICT");

  const mismatchEmail = `mismatch-${suffix}@tokyois.com`;
  const firstClaims = claims(mismatchEmail, `first-${suffix}`);
  const firstUser = `auth-first-${suffix}`;
  await associateGoogleIdentity(sql, firstUser, firstClaims);
  await expectCode(associateGoogleIdentity(sql, firstUser, claims(mismatchEmail, `different-${suffix}`)), "IDENTITY_CONFLICT");
  await expectCode(associateGoogleIdentity(sql, `auth-second-${suffix}`, firstClaims), "IDENTITY_CONFLICT");

  const clubClaims = claims("mathclub@tokyois.com", `club-${suffix}`);
  const clubId = await associateGoogleIdentity(sql, `auth-club-${suffix}`, clubClaims);
  assert.equal(await hasAccess(sql, clubId, "admin"), true);
  const studentEmail = `ordinary-${suffix}@tokyois.com`;
  const studentId = await associateGoogleIdentity(sql, `auth-student-${suffix}`, claims(studentEmail, `student-${suffix}`));
  assert.equal(await hasAccess(sql, studentId, "admin"), false);
  assert.equal(await hasAccess(sql, studentId, "member"), false);
  assert.equal((await sql`select count(*)::int as n from people.role_grants where identity_id=${studentId} and role='admin'`)[0].n, 0);
  await sql`insert into content.leadership_profiles(display_name,title,published) values ('Test member','President',true)`;
  assert.equal(await hasAccess(sql, studentId, "admin"), false);

  assert.equal(googleClaims.safeParse({ ...claims(`external-${suffix}@example.com`), hd: "example.com" }).success, false);
  assert.equal(googleClaims.safeParse({ ...claims(`unverified-${suffix}@tokyois.com`), email_verified: false }).success, false);
  await assert.rejects(
    associateGoogleIdentity(sql, `auth-bad-${suffix}`, {
      ...claims(`bad-${suffix}@tokyois.com`), hd: "example.com",
    }),
    (error: unknown) => error instanceof ZodError,
  );

  const sessionEmail = `session-${suffix}@tokyois.com`;
  const sessionUserId = `auth-session-${suffix}`;
  const sessionClaims = claims(sessionEmail, `session-${suffix}`);
  process.env.GOOGLE_OAUTH_CLIENT_ID = "synthetic-test-client";
  await sql`insert into neon_auth.account(id,"userId","providerId","accountId","idToken")
    values (${`fixture-${suffix}`},${sessionUserId},'google',${sessionClaims.sub},'synthetic-test-token')`;
  const getCurrentUser = createCurrentUser(
    sql,
    async () => ({ user: { id: sessionUserId, email: sessionEmail, emailVerified: true } }),
    async (token, audience) => {
      assert.equal(token, "synthetic-test-token");
      assert.ok(audience.length > 0);
      return sessionClaims;
    },
  );
  const sessionUser = await getCurrentUser();
  assert.equal(sessionUser.email, sessionEmail);
  assert.equal(sessionUser.admin, false);
  assert.equal(sessionUser.member, false);
  assert.equal(sessionUser.id, await associateGoogleIdentity(sql, sessionUserId, sessionClaims));
  await sql`delete from neon_auth.account where "userId"=${sessionUserId}`;

  const changedEmail = `changed-${suffix}@tokyois.com`;
  const changedAuthId = `auth-changed-${suffix}`;
  const changedSubject = `google-changed-${suffix}`;
  await sql`insert into people.identities(auth_user_id,google_subject,email,school_verified)
    values (${changedAuthId},${changedSubject},${`old-${suffix}@tokyois.com`},true)`;
  await sql`insert into people.identities(email) values (${changedEmail})`;
  await sql`insert into neon_auth.account(id,"userId","providerId","accountId","idToken")
    values (${`fixture-changed-${suffix}`},${changedAuthId},'google',${changedSubject},'synthetic-changed-email-token')`;
  const changedCurrentUser = createCurrentUser(
    sql,
    async () => ({ user: { id: changedAuthId, email: changedEmail, emailVerified: true } }),
    async () => ({ ...claims(changedEmail, `changed-${suffix}`), sub: changedSubject }),
  );
  await expectCode(changedCurrentUser(), "IDENTITY_CONFLICT");

  const multipleAuthId = `auth-multiple-${suffix}`;
  await sql`insert into neon_auth.account(id,"userId","providerId","accountId","idToken") values
    (${`fixture-multiple-a-${suffix}`},${multipleAuthId},'google',${`google-a-${suffix}`},null),
    (${`fixture-multiple-b-${suffix}`},${multipleAuthId},'google',${`google-b-${suffix}`},null)`;
  const multipleCurrentUser = createCurrentUser(sql, async () => ({
    user: { id: multipleAuthId, email: `multiple-${suffix}@tokyois.com`, emailVerified: true },
  }));
  await expectCode(multipleCurrentUser(), "IDENTITY_CONFLICT");
  await sql`delete from neon_auth.account where "userId" in (${changedAuthId},${multipleAuthId})`;

  const unverifiedUser = createCurrentUser(sql, async () => ({
    user: { id: `auth-unverified-${suffix}`, email: `claim-${suffix}@tokyois.com`, emailVerified: false },
  }));
  await expectCode(unverifiedUser(), "FORBIDDEN");
  const nonSchoolUser = createCurrentUser(sql, async () => ({
    user: { id: `auth-outsider-${suffix}`, email: `outsider-${suffix}@example.com`, emailVerified: true },
  }));
  await expectCode(nonSchoolUser(), "FORBIDDEN");
}
