import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { withDatabase } from "@/lib/db/client.server";
import {
  recordBusinessAuditEvent,
  recordSecurityAuditEvent,
} from "@/lib/security/audit";
import {
  type Capability,
  type TechnicalAccessLevel,
  hasCapability,
} from "./capabilities";
import { verifyGoogleIdToken } from "./google-claims.server";
import { getNeonAuth } from "./neon.server";

export type IdentityAccess = {
  identityId: string;
  email: string;
  affiliationStatus: string;
  active: boolean;
  accessLevel: string | null;
};

const AccessRowSchema = z.object({
  identity_id: z.string().uuid(),
  email: z.string(),
  affiliation_status: z.string(),
  active: z.boolean(),
  access_level: z.string().nullable(),
});

const AssociatedIdentitySchema = z.object({
  identity_id: z.string().uuid(),
  affiliation_status: z.string(),
  active: z.boolean(),
});

import { AccessDeniedError } from "./errors";
export { AccessDeniedError };

export async function associateCurrentGoogleIdentity(correlationId: string) {
  const auth = getNeonAuth();
  const sessionResult = await auth.getSession({
    query: { disableCookieCache: "true" },
  });
  const session = sessionResult.data;
  if (!session?.user) throw new AccessDeniedError("session_invalid");

  const tokenResult = await auth.getAccessToken({ providerId: "google" });
  const idToken = tokenResult.data?.idToken;
  let claims;
  if (idToken) {
    claims = await verifyGoogleIdToken(idToken);
  } else {
    const accountsResult = await auth.listAccounts();
    const googleAccount = accountsResult.data?.find(
      (account) => account.providerId === "google",
    );
    if (
      !googleAccount?.accountId ||
      !session.user.email ||
      !session.user.emailVerified
    ) {
      throw new AccessDeniedError("signed_google_evidence_unavailable");
    }
    claims = {
      subject: googleAccount.accountId,
      email: session.user.email.toLowerCase(),
      hostedDomain: null,
    };
  }

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const result = await transaction.execute(sql<{
        identity_id: string;
        affiliation_status: string;
        active: boolean;
      }>`select * from logos.associate_application_identity(
        ${session.user.id}, ${claims.subject}, ${claims.email}, ${true}, ${claims.hostedDomain}
      )`);
      const parsedIdentity = AssociatedIdentitySchema.safeParse(result.rows[0]);
      if (!parsedIdentity.success)
        throw new AccessDeniedError("identity_association_failed");
      const identity = parsedIdentity.data;

      await recordSecurityAuditEvent(transaction, {
        actorId: identity.identity_id,
        actorType: "user",
        actorRoleSnapshot: "none",
        source: "web",
        correlationId,
        category: "identity",
        action: "associate",
        targetType: "application_identity",
        targetId: identity.identity_id,
        result: "success",
        reasonCode:
          identity.affiliation_status === "verified"
            ? "google_hd_approved"
            : "google_hd_pending",
        metadata: { affiliationStatus: identity.affiliation_status },
      });
      return identity;
    }),
  );
}

export async function resolveCurrentIdentity(options?: {
  freshSession?: boolean;
}): Promise<IdentityAccess> {
  const sessionResult = await getNeonAuth().getSession(
    options?.freshSession
      ? { query: { disableCookieCache: "true" } }
      : undefined,
  );
  const session = sessionResult.data;
  if (!session?.user) throw new AccessDeniedError("session_invalid");

  const result = await withDatabase((database) =>
    database.execute(
      sql`select * from logos.resolve_identity_access(${session.user.id})`,
    ),
  );
  const parsedRow = AccessRowSchema.safeParse(result.rows[0]);
  if (!parsedRow.success) throw new AccessDeniedError("identity_missing");
  const row = parsedRow.data;

  return {
    identityId: row.identity_id,
    email: row.email,
    affiliationStatus: row.affiliation_status,
    active: row.active,
    accessLevel: row.access_level,
  };
}

export async function requireCapability(
  capability: Capability,
  correlationId: string,
  options?: { freshSession?: boolean },
): Promise<IdentityAccess> {
  let identity: IdentityAccess | undefined;
  try {
    identity = await resolveCurrentIdentity(options);
    if (
      !identity.active ||
      identity.affiliationStatus !== "verified" ||
      !hasCapability(identity.accessLevel, capability)
    ) {
      throw new AccessDeniedError("capability_denied");
    }
    return identity;
  } catch (error) {
    await withDatabase((database) =>
      recordSecurityAuditEvent(database, {
        actorId: identity?.identityId ?? null,
        actorType: identity ? "user" : "anonymous",
        actorRoleSnapshot: "none",
        source: "action",
        correlationId,
        category: "authorization",
        action: "deny",
        targetType: "capability",
        targetId: capability,
        result: "denied",
        reasonCode:
          error instanceof AccessDeniedError ? error.code : "guard_failed",
        metadata: { policy: capability },
      }),
    ).catch(() => undefined);
    throw error instanceof AccessDeniedError
      ? error
      : new AccessDeniedError("guard_failed");
  }
}

export async function bootstrapAccessAdmin(
  identityId: string,
  correlationId: string,
) {
  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const auditId = randomUUID();
      await recordBusinessAuditEvent(transaction, {
        id: auditId,
        actorId: identityId,
        actorType: "user",
        actorRoleSnapshot: "none",
        source: "internal",
        correlationId,
        category: "access",
        action: "bootstrap",
        targetType: "application_identity",
        targetId: identityId,
        result: "success",
        reasonCode: "initial_bootstrap",
        afterSummary: { accessLevel: "access_admin" },
      });
      const result = await transaction.execute(
        sql<{
          bootstrap_access_admin: string;
        }>`select logos.bootstrap_access_admin(${identityId}::uuid, ${auditId}::uuid)`,
      );
      return result.rows[0]?.bootstrap_access_admin;
    }),
  );
}

export async function setTechnicalAccess(
  targetIdentityId: string,
  level: TechnicalAccessLevel,
  reasonCode: string,
  correlationId: string,
) {
  const actor = await requireCapability("access:assign", correlationId, {
    freshSession: true,
  });
  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const result = await transaction.execute(
        sql`select logos.set_technical_access(${actor.identityId}::uuid, ${targetIdentityId}::uuid, ${level}::logos.technical_access_level, ${reasonCode}) as assignment_id`,
      );
      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "none",
        source: "action",
        correlationId,
        category: "access",
        action: "assign",
        targetType: "application_identity",
        targetId: targetIdentityId,
        result: "success",
        reasonCode,
        afterSummary: { accessLevel: level },
      });
      return z
        .object({ assignment_id: z.string().uuid() })
        .parse(result.rows[0]).assignment_id;
    }),
  );
}

export async function revokeTechnicalAccess(
  targetIdentityId: string,
  reasonCode: string,
  correlationId: string,
) {
  const actor = await requireCapability("access:revoke", correlationId, {
    freshSession: true,
  });
  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const result = await transaction.execute(
        sql`select logos.revoke_technical_access(${actor.identityId}::uuid, ${targetIdentityId}::uuid, ${reasonCode}) as revoked`,
      );
      const revoked = z
        .object({ revoked: z.boolean() })
        .parse(result.rows[0]).revoked;
      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "none",
        source: "action",
        correlationId,
        category: "access",
        action: "revoke",
        targetType: "application_identity",
        targetId: targetIdentityId,
        result: "success",
        reasonCode,
        beforeSummary: { status: revoked ? "active" : "absent" },
        afterSummary: { status: "revoked" },
      });
      return revoked;
    }),
  );
}

export async function deactivateApplicationIdentity(
  targetIdentityId: string,
  reasonCode: string,
  correlationId: string,
) {
  const actor = await requireCapability("session:revoke", correlationId, {
    freshSession: true,
  });
  const neonAuthUserId = await withDatabase((database) =>
    database.transaction(async (transaction) => {
      const result = await transaction.execute(
        sql`select logos.deactivate_application_identity(${actor.identityId}::uuid, ${targetIdentityId}::uuid, ${reasonCode}) as neon_auth_user_id`,
      );
      const userId = z
        .object({ neon_auth_user_id: z.string().nullable() })
        .parse(result.rows[0]).neon_auth_user_id;
      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "none",
        source: "action",
        correlationId,
        category: "identity",
        action: "deactivate",
        targetType: "application_identity",
        targetId: targetIdentityId,
        result: "success",
        reasonCode,
        beforeSummary: { status: userId ? "active" : "inactive" },
        afterSummary: { status: "revoked" },
      });
      return userId;
    }),
  );

  if (!neonAuthUserId) return false;
  try {
    const result = await getNeonAuth().admin.revokeUserSessions({
      userId: neonAuthUserId,
    });
    if (!result.data?.success) throw new Error("Provider revocation failed");
  } catch {
    await withDatabase((database) =>
      recordSecurityAuditEvent(database, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "none",
        source: "internal",
        correlationId,
        category: "session",
        action: "provider_revoke",
        targetType: "application_identity",
        targetId: targetIdentityId,
        result: "failed",
        reasonCode: "provider_revocation_failed",
        metadata: { failureCode: "provider_revocation_failed" },
      }),
    ).catch(() => undefined);
  }
  return true;
}
