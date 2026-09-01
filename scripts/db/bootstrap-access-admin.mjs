import { randomUUID } from "node:crypto";

import {
  assertDatabaseEnvironmentIdentity,
  createSqlClient,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

requireNonProductionEnvironment();
if (process.env.CONFIRM_PHASE04_BOOTSTRAP !== "bootstrap-once") {
  throw new Error(
    "Set CONFIRM_PHASE04_BOOTSTRAP=bootstrap-once to confirm the non-production one-time bootstrap",
  );
}

const identityId = requireEnvironmentVariable("BOOTSTRAP_IDENTITY_ID");
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    identityId,
  )
) {
  throw new Error("BOOTSTRAP_IDENTITY_ID must be an application identity UUID");
}

const migrationUrl = requireEnvironmentVariable("MIGRATION_DATABASE_URL");
const sql = createSqlClient("MIGRATION_DATABASE_URL");

try {
  await assertDatabaseEnvironmentIdentity(
    sql,
    "MIGRATION_DATABASE_URL",
    migrationUrl,
  );
  const correlationId = randomUUID();
  const auditId = randomUUID();
  const assignmentId = await sql.begin(async (transaction) => {
    await transaction`
      insert into logos.business_audit_journal (
        id, actor_id, actor_type, actor_role_snapshot, source, correlation_id,
        category, action, target_type, target_id, result, reason_code,
        after_summary
      ) values (
        ${auditId}::uuid, ${identityId}::uuid, 'user', 'none', 'internal',
        ${correlationId}::uuid, 'access', 'bootstrap', 'application_identity',
        ${identityId}, 'success', 'initial_bootstrap',
        '{"accessLevel":"access_admin"}'::jsonb
      )
    `;
    const [result] = await transaction`
      select logos.bootstrap_access_admin(
        ${identityId}::uuid,
        ${auditId}::uuid
      ) as assignment_id
    `;
    return result?.assignment_id;
  });
  if (!assignmentId) throw new Error("Bootstrap returned no assignment");
  console.log(`Non-production access bootstrap completed: ${assignmentId}`);
} finally {
  await sql.end();
}
