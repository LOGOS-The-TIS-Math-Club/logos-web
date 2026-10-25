import type postgres from "postgres";
import { BackendError } from "../server/errors.ts";
import { googleClaims, verifyGoogleToken } from "./google.ts";

export type ProviderSession = {
  user: { id: string; email: string; emailVerified: boolean };
};
export type CurrentUser = {
  id: string;
  email: string;
  admin: boolean;
  member: boolean;
};
export type SessionLookup = () => Promise<ProviderSession | null>;

// Called only with claims verified by the server-side Google verifier. Never request JSON.
export async function associateGoogleIdentity(
  sql: postgres.Sql,
  userId: string,
  raw: unknown,
) {
  const claims = googleClaims.parse(raw);
  const email = claims.email.toLowerCase();
  return sql.begin(async (tx) => {
    // Serializes first sign-in and imported email reconciliation across different Auth IDs.
    await tx`select pg_advisory_xact_lock(hashtextextended(${email}, 0))`;
    const linked =
      await tx`select * from people.identities where auth_user_id=${userId} or google_subject=${claims.sub} for update`;
    if (linked.length > 1)
      throw new BackendError(
        "IDENTITY_CONFLICT",
        "Your account needs administrator reconciliation.",
        409,
      );
    let person = linked[0];
    if (
      person &&
      ((person.auth_user_id && person.auth_user_id !== userId) ||
        (person.google_subject && person.google_subject !== claims.sub))
    )
      throw new BackendError(
        "IDENTITY_CONFLICT",
        "Your account needs administrator reconciliation.",
        409,
      );
    const candidates =
      await tx`select * from people.identities where lower(email)=${email} for update`;
    if (person && candidates.some((candidate) => candidate.id !== person.id))
      throw new BackendError(
        "IDENTITY_CONFLICT",
        "Your account needs administrator reconciliation.",
        409,
      );
    if (!person) {
      if (
        candidates.length > 1 ||
        candidates.some((p) => p.auth_user_id || p.google_subject)
      )
        throw new BackendError(
          "IDENTITY_CONFLICT",
          "Your account needs administrator reconciliation.",
          409,
        );
      person = candidates[0];
    }
    if (person && !person.enabled)
      throw new BackendError("FORBIDDEN", "Your account is disabled.", 403);
    if (person) {
      [person] =
        await tx`update people.identities set auth_user_id=${userId},google_subject=${claims.sub},email=${email},school_verified=true where id=${person.id} returning *`;
    } else {
      [person] =
        await tx`insert into people.identities(auth_user_id,google_subject,email,school_verified) values(${userId},${claims.sub},${email},true) returning *`;
    }
    // Explicit club-account grant; leadership titles never confer authority.
    if (email === "mathclub@tokyois.com") {
      const grants =
        await tx`insert into people.role_grants(identity_id,role,granted_by) values(${person!.id},'admin',${person!.id}) on conflict do nothing returning identity_id`;
      if (grants.length)
        await tx`insert into operations.change_history(actor_id,action,entity_id) values(${person!.id},'access.club_admin_granted',${person!.id})`;
    }
    return person!.id as string;
  });
}

export function createCurrentUser(
  sql: postgres.Sql,
  sessionLookup: SessionLookup,
  verifyToken = verifyGoogleToken,
) {
  return async (): Promise<CurrentUser> => {
    const session = await sessionLookup();
    if (!session)
      throw new BackendError(
        "UNAUTHENTICATED",
        "Sign in with your school Google account.",
        401,
      );
    const user = session.user;
    if (!user.emailVerified || !/^[^@\s]+@tokyois\.com$/i.test(user.email))
      throw new BackendError(
        "FORBIDDEN",
        "A verified school Google account is required.",
        403,
      );
    // Provider-owned tables are read-only. The session is resolved upstream, never from JSON.
    const accounts =
      await sql`select "accountId" as subject,"idToken" as token from neon_auth.account where "userId"=${user.id} and "providerId"='google'`;
    if (accounts.length > 1)
      throw new BackendError(
        "IDENTITY_CONFLICT",
        "More than one Google account is linked. Ask an administrator to reconcile your account.",
        409,
      );
    const account = accounts[0];
    if (!account?.subject)
      throw new BackendError(
        "FORBIDDEN",
        "Sign in using Google to link your school account.",
        403,
      );
    let [identity] =
      await sql`select id,email,enabled,school_verified,google_subject from people.identities where auth_user_id=${user.id}`;
    if (
      !identity ||
      identity.google_subject !== account.subject ||
      identity.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      if (!account.token || !process.env.GOOGLE_OAUTH_CLIENT_ID)
        throw new BackendError(
          "GOOGLE_VERIFICATION_REQUIRED",
          "Google account verification is needed. Sign out and sign in with Google again.",
          403,
        );
      let claims;
      try {
        claims = await verifyToken(
          account.token,
          process.env.GOOGLE_OAUTH_CLIENT_ID,
        );
      } catch {
        throw new BackendError(
          "GOOGLE_VERIFICATION_REQUIRED",
          "Google verification expired or failed. Sign in with Google again.",
          403,
        );
      }
      if (
        claims.sub !== account.subject ||
        claims.email.toLowerCase() !== user.email.toLowerCase()
      )
        throw new BackendError(
          "FORBIDDEN",
          "Google account details do not match this session.",
          403,
        );
      const id = await associateGoogleIdentity(sql, user.id, claims);
      [identity] =
        await sql`select id,email,enabled,school_verified,google_subject from people.identities where id=${id}`;
    }
    if (!identity?.enabled || !identity.school_verified)
      throw new BackendError(
        "FORBIDDEN",
        "Your account does not have school access.",
        403,
      );
    const [access] =
      await sql`select people.has_access(${identity.id},'admin') as admin,people.has_access(${identity.id},'member') as member`;
    return {
      id: identity.id,
      email: identity.email,
      admin: access.admin,
      member: access.member,
    };
  };
}
