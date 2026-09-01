import { randomUUID } from "node:crypto";
import {
  assertDatabaseEnvironmentIdentity,
  createSqlClient,
  isInsufficientPrivilege,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

requireNonProductionEnvironment();

const testDatabaseUrl = requireEnvironmentVariable("TEST_DATABASE_URL");
const runtimeDatabaseUrl = requireEnvironmentVariable("DATABASE_URL");
const backupDatabaseUrl = requireEnvironmentVariable("BACKUP_DATABASE_URL");
const ownerSql = createSqlClient("TEST_DATABASE_URL");
const runtimeSql = createSqlClient("DATABASE_URL");
const backupSql = createSqlClient("BACKUP_DATABASE_URL");

async function expectPermissionDenied(label, operation) {
  try {
    await operation();
  } catch (error) {
    if (isInsufficientPrivilege(error)) {
      return;
    }
    throw error;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

try {
  await assertDatabaseEnvironmentIdentity(
    ownerSql,
    "TEST_DATABASE_URL",
    testDatabaseUrl,
  );
  await assertDatabaseEnvironmentIdentity(
    runtimeSql,
    "DATABASE_URL",
    runtimeDatabaseUrl,
  );
  await assertDatabaseEnvironmentIdentity(
    backupSql,
    "BACKUP_DATABASE_URL",
    backupDatabaseUrl,
  );

  const policyRoles = [
    "logos_migration",
    "logos_runtime",
    "logos_backup",
    "logos_audit",
  ];
  const roles = await ownerSql`
    select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
    from pg_roles
    where rolname in ${ownerSql(policyRoles)}
    order by rolname
  `;
  if (
    roles.length !== policyRoles.length ||
    roles.some(
      (role) =>
        role.rolcanlogin ||
        role.rolsuper ||
        role.rolcreatedb ||
        role.rolcreaterole,
    )
  ) {
    throw new Error(
      "Database policy roles must exist as unprivileged NOLOGIN roles",
    );
  }

  const loginRoles = await ownerSql`
    select rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
    from pg_roles
    where rolname in ${ownerSql(["logos_ci_runtime", "logos_ci_backup"])}
    order by rolname
  `;
  if (
    loginRoles.length !== 2 ||
    loginRoles.some(
      (role) =>
        !role.rolcanlogin ||
        !role.rolinherit ||
        role.rolsuper ||
        role.rolcreatedb ||
        role.rolcreaterole ||
        role.rolbypassrls,
    )
  ) {
    throw new Error("Test logins must remain unprivileged login roles");
  }

  const [databaseAccess] = await ownerSql`
    select
      has_database_privilege('logos_runtime', current_database(), 'CONNECT') as runtime_connect,
      has_database_privilege('logos_backup', current_database(), 'CONNECT') as backup_connect,
      has_database_privilege('logos_audit', current_database(), 'CONNECT') as audit_connect
  `;
  if (
    !databaseAccess?.runtime_connect ||
    !databaseAccess.backup_connect ||
    databaseAccess.audit_connect
  ) {
    throw new Error(
      "Database access must be explicit for runtime and backup roles",
    );
  }

  const [runtimeIdentity] = await runtimeSql`
    select current_user, session_user
  `;
  if (
    runtimeIdentity?.current_user !== "logos_ci_runtime" ||
    runtimeIdentity?.session_user !== "logos_ci_runtime"
  ) {
    throw new Error("Runtime tests require a real unprivileged login");
  }
  await runtimeSql`set logos.app_environment = 'preview'`;
  await assertDatabaseEnvironmentIdentity(
    runtimeSql,
    "DATABASE_URL",
    runtimeDatabaseUrl,
  );
  await runtimeSql`reset logos.app_environment`;

  const [fixture] = await runtimeSql`
    select marker from logos.infrastructure_probe where id = 1
  `;
  if (fixture?.marker !== "logos-phase-02-synthetic") {
    throw new Error("Synthetic fixture is missing or unexpected");
  }

  // --- Phase 02 Baseline Checks ---
  await runtimeSql.begin(async (transaction) => {
    await transaction`
      insert into logos.infrastructure_probe (id, marker)
      values (2, 'logos-phase-02-runtime-probe')
    `;
    await transaction`
      update logos.infrastructure_probe
      set marker = 'logos-phase-02-runtime-updated'
      where id = 2
    `;
    await transaction`delete from logos.infrastructure_probe where id = 2`;
  });

  await expectPermissionDenied("runtime DDL", async () => {
    await runtimeSql.begin(async (transaction) => {
      await transaction`create table logos.runtime_must_not_create (id integer)`;
    });
  });

  await expectPermissionDenied("runtime schema creation", async () => {
    await runtimeSql.begin(async (transaction) => {
      await transaction`create schema runtime_must_not_create`;
    });
  });

  await runtimeSql`reset role`;
  await expectPermissionDenied("runtime DDL after RESET ROLE", async () => {
    await runtimeSql`create table logos.runtime_reset_must_not_create (id integer)`;
  });

  // --- Phase 03 Rate Limits Checks ---
  await runtimeSql.begin(async (transaction) => {
    const testHash = "a".repeat(64);
    await transaction`
      insert into logos.rate_limits (subject_hash, policy, window_start, count)
      values (${testHash}, 'synthetic_test_policy', to_timestamp(0), 1)
      on conflict (subject_hash, policy, window_start)
      do update set count = logos.rate_limits.count + 1
    `;
    const [rl] = await transaction`
      select count from logos.rate_limits where subject_hash = ${testHash}
    `;
    if (rl?.count !== 1) {
      throw new Error("Rate limit upsert failed");
    }
    await transaction`delete from logos.rate_limits where subject_hash = ${testHash}`;
  });

  // --- Phase 03 Audit Journals Role Hardening Checks ---
  const testCorrelationId = randomUUID();
  const createdBusinessAuditId = randomUUID();
  const createdSecurityAuditId = randomUUID();

  // 1. Runtime can INSERT into business audit journal (INSERT-only, no RETURNING)
  await runtimeSql.begin(async (transaction) => {
    await transaction`
      insert into logos.business_audit_journal (
        id, actor_type, actor_role_snapshot, source, correlation_id,
        category, action, target_type, target_id, result,
        before_summary, after_summary, metadata
      ) values (
        ${createdBusinessAuditId}::uuid, 'system', 'none', 'internal', ${testCorrelationId}::uuid,
        'technical_test', 'probe.test', 'probe', '1', 'success',
        '{"marker": "old"}'::jsonb, '{"marker": "new"}'::jsonb, '{"reason": "test"}'::jsonb
      )
    `;
  });

  // 2. Runtime can INSERT into security audit journal (INSERT-only, no RETURNING)
  await runtimeSql.begin(async (transaction) => {
    await transaction`
      insert into logos.security_audit_journal (
        id, actor_type, actor_role_snapshot, source, correlation_id,
        category, action, target_type, target_id, result,
        metadata
      ) values (
        ${createdSecurityAuditId}::uuid, 'anonymous', 'none', 'web', ${testCorrelationId}::uuid,
        'rate_limit', 'reject', 'ip_subject', 'hash123', 'rate_limited',
        '{"policy": "test"}'::jsonb
      )
    `;
  });

  // 3. Runtime is DENIED raw SELECT on audit journals
  await expectPermissionDenied(
    "runtime direct SELECT business audit journal",
    async () => {
      await runtimeSql`select * from logos.business_audit_journal`;
    },
  );

  await expectPermissionDenied(
    "runtime direct SELECT security audit journal",
    async () => {
      await runtimeSql`select * from logos.security_audit_journal`;
    },
  );

  // 4. Runtime is DENIED UPDATE, DELETE, TRUNCATE, and ALTER on audit journals
  await expectPermissionDenied(
    "runtime UPDATE business audit journal",
    async () => {
      await runtimeSql`update logos.business_audit_journal set result = 'denied'`;
    },
  );

  await expectPermissionDenied(
    "runtime DELETE business audit journal",
    async () => {
      await runtimeSql`delete from logos.business_audit_journal`;
    },
  );

  await expectPermissionDenied(
    "runtime TRUNCATE business audit journal",
    async () => {
      await runtimeSql`truncate table logos.business_audit_journal`;
    },
  );

  await expectPermissionDenied(
    "runtime ALTER business audit journal",
    async () => {
      await runtimeSql`alter table logos.business_audit_journal add column hacked text`;
    },
  );

  // 5. Authorized search via hardened SECURITY DEFINER function succeeds
  const searchResults = await runtimeSql`
    select * from logos.search_audit_journal(
      'business',
      10,
      null, null,
      ${testCorrelationId}::uuid,
      null, null, null
    )
  `;
  if (
    searchResults.length === 0 ||
    searchResults[0].correlation_id !== testCorrelationId
  ) {
    throw new Error(
      "Hardened search_audit_journal function did not return expected event",
    );
  }

  // Search function boundary validations
  try {
    await runtimeSql`select * from logos.search_audit_journal('business', 10, null, null, null, null, null, null)`;
    throw new Error(
      "search_audit_journal should have rejected call without narrowing filters",
    );
  } catch (err) {
    if (!err.message.includes("requires at least one narrowing filter")) {
      throw err;
    }
  }

  try {
    await runtimeSql`select * from logos.search_audit_journal('business', 101, null, null, ${testCorrelationId}::uuid, null, null, null)`;
    throw new Error("search_audit_journal should have rejected limit > 100");
  } catch (err) {
    if (!err.message.includes("Limit must be between 1 and 100")) {
      throw err;
    }
  }

  try {
    await runtimeSql`select * from logos.search_audit_journal('business', 10, '2026-09-02'::date, '2026-09-01'::date, null, null, null, null)`;
    throw new Error(
      "search_audit_journal should have rejected start_date > end_date",
    );
  } catch (err) {
    if (!err.message.includes("Start date cannot be after end date")) {
      throw err;
    }
  }

  // --- Phase 03 Durable Operations Checks ---
  const testIdempotencyKey = `idem-${Date.now()}`;
  let createdOpId;

  // 1. Runtime can INSERT and SELECT on durable_operations
  await runtimeSql.begin(async (transaction) => {
    const [op] = await transaction`
      insert into logos.durable_operations (
        correlation_id, audit_event_id, type, idempotency_key, payload, max_attempts
      ) values (
        ${testCorrelationId}::uuid, ${createdBusinessAuditId}::uuid,
        'synthetic_operation', ${testIdempotencyKey},
        '{"marker": "test"}'::jsonb, 3
      )
      returning id, status
    `;
    createdOpId = op?.id;
    if (!createdOpId || op?.status !== "pending") {
      throw new Error("Durable operation insertion failed");
    }

    const [selected] = await transaction`
      select id, status from logos.durable_operations where id = ${createdOpId}::uuid
    `;
    if (selected?.id !== createdOpId) {
      throw new Error("Durable operation SELECT failed for runtime role");
    }
  });

  // 2. Runtime is DENIED direct UPDATE, DELETE, TRUNCATE on durable_operations
  await expectPermissionDenied(
    "runtime direct UPDATE durable_operations",
    async () => {
      await runtimeSql`update logos.durable_operations set status = 'succeeded' where id = ${createdOpId}::uuid`;
    },
  );

  await expectPermissionDenied(
    "runtime direct DELETE durable_operations",
    async () => {
      await runtimeSql`delete from logos.durable_operations where id = ${createdOpId}::uuid`;
    },
  );

  await expectPermissionDenied(
    "runtime direct TRUNCATE durable_operations",
    async () => {
      await runtimeSql`truncate table logos.durable_operations`;
    },
  );

  // 3. Database function input boundary validation checks
  try {
    await runtimeSql`select * from logos.claim_durable_operation('worker-test', '-10 seconds'::interval, 1)`;
    throw new Error(
      "claim_durable_operation should have rejected negative lease duration",
    );
  } catch (err) {
    if (
      !err.message.includes(
        "Lease duration must be between 1 second and 3600 seconds",
      )
    ) {
      throw err;
    }
  }

  try {
    await runtimeSql`select * from logos.claim_durable_operation('worker-test', '4000 seconds'::interval, 1)`;
    throw new Error(
      "claim_durable_operation should have rejected extreme lease duration (> 3600s)",
    );
  } catch (err) {
    if (
      !err.message.includes(
        "Lease duration must be between 1 second and 3600 seconds",
      )
    ) {
      throw err;
    }
  }

  try {
    await runtimeSql`select * from logos.claim_durable_operation('worker-test', '60 seconds'::interval, 101)`;
    throw new Error(
      "claim_durable_operation should have rejected claim limit > 100",
    );
  } catch (err) {
    if (!err.message.includes("Claim limit must be between 1 and 100")) {
      throw err;
    }
  }

  try {
    const hugeWorkerId = "x".repeat(257);
    await runtimeSql`select * from logos.claim_durable_operation(${hugeWorkerId}, '60 seconds'::interval, 1)`;
    throw new Error(
      "claim_durable_operation should have rejected worker ID > 256 chars",
    );
  } catch (err) {
    if (
      !err.message.includes(
        "Worker reference exceeds maximum length of 256 characters",
      )
    ) {
      throw err;
    }
  }

  try {
    await runtimeSql`
      select logos.complete_durable_operation(
        ${createdOpId}::uuid,
        ''::text,
        'succeeded'::logos.operation_status
      )
    `;
    throw new Error(
      "complete_durable_operation should have rejected empty lease token",
    );
  } catch (err) {
    if (!err.message.includes("Invalid lease token")) {
      throw err;
    }
  }

  try {
    await runtimeSql`
      select logos.fail_durable_operation(
        ${createdOpId}::uuid,
        'valid-token'::text,
        'ERROR',
        'Error detail',
        '-5 seconds'::interval
      )
    `;
    throw new Error(
      "fail_durable_operation should have rejected negative retry delay",
    );
  } catch (err) {
    if (
      !err.message.includes(
        "Retry delay must be between 1 second and 604800 seconds",
      )
    ) {
      throw err;
    }
  }

  try {
    await runtimeSql`
      select logos.fail_durable_operation(
        ${createdOpId}::uuid,
        'valid-token'::text,
        'ERROR',
        'Error detail',
        '8 days'::interval
      )
    `;
    throw new Error(
      "fail_durable_operation should have rejected extreme retry delay (> 7 days)",
    );
  } catch (err) {
    if (
      !err.message.includes(
        "Retry delay must be between 1 second and 604800 seconds",
      )
    ) {
      throw err;
    }
  }

  // 4. Live Lease Fencing & Reclaim Integration Coverage
  // Worker 1 claims operation with 1 second short lease
  const claimed1List = await runtimeSql`
    select * from logos.claim_durable_operation('worker-1', '1 second'::interval, 100)
  `;
  const claimed1 = claimed1List.find((r) => r.id === createdOpId);
  if (
    !claimed1 ||
    claimed1.status !== "processing" ||
    claimed1.attempt_count !== 1 ||
    !claimed1.lease_token
  ) {
    throw new Error("Worker 1 failed to claim operation with short lease");
  }
  const token1 = claimed1.lease_token;

  // Invalid / mismatched lease token cannot complete
  const [mismatchedRes] = await runtimeSql`
    select logos.complete_durable_operation(
      ${createdOpId}::uuid,
      'wrong-lease-token'::text,
      'succeeded'::logos.operation_status
    ) as result
  `;
  if (mismatchedRes?.result) {
    throw new Error(
      "complete_durable_operation must reject mismatched lease token",
    );
  }

  // Wait for Worker 1 lease to expire (> 1 second)
  await new Promise((resolve) => setTimeout(resolve, 1100));

  // Expired Worker 1 attempts to complete BEFORE another worker claims -> must fail closed
  const [expiredCompleteRes] = await runtimeSql`
    select logos.complete_durable_operation(
      ${createdOpId}::uuid,
      ${token1}::text,
      'succeeded'::logos.operation_status
    ) as result
  `;
  if (expiredCompleteRes?.result) {
    throw new Error(
      "complete_durable_operation must fence expired lease token before reclaim",
    );
  }

  // Expired Worker 1 attempts to fail BEFORE another worker claims -> must fail closed
  const [expiredFailRes] = await runtimeSql`
    select logos.fail_durable_operation(
      ${createdOpId}::uuid,
      ${token1}::text,
      'TIMEOUT'::text,
      'Timed out'::text,
      '10 seconds'::interval
    ) as result
  `;
  if (expiredFailRes?.result) {
    throw new Error(
      "fail_durable_operation must fence expired lease token before reclaim",
    );
  }

  // Worker 2 reclaims the expired operation
  const claimed2List = await runtimeSql`
    select * from logos.claim_durable_operation('worker-2', '60 seconds'::interval, 100)
  `;
  const claimed2 = claimed2List.find((r) => r.id === createdOpId);
  if (
    !claimed2 ||
    claimed2.status !== "processing" ||
    claimed2.attempt_count !== 2 ||
    !claimed2.lease_token
  ) {
    throw new Error("Worker 2 failed to reclaim expired operation");
  }
  const token2 = claimed2.lease_token;
  if (token1 === token2) {
    throw new Error("Reclaimed operation must receive a brand new lease token");
  }

  // Worker 1 (stale) tries to complete with old token -> must fail closed
  const [staleCompleteRes] = await runtimeSql`
    select logos.complete_durable_operation(
      ${createdOpId}::uuid,
      ${token1}::text,
      'succeeded'::logos.operation_status
    ) as result
  `;
  if (staleCompleteRes?.result) {
    throw new Error("Stale lease token must not overwrite reclaimed operation");
  }

  // Worker 1 (stale) tries to fail with old token -> must fail closed
  const [staleFailRes] = await runtimeSql`
    select logos.fail_durable_operation(
      ${createdOpId}::uuid,
      ${token1}::text,
      'STALE_ERROR'::text,
      'Old error'::text,
      '10 seconds'::interval
    ) as result
  `;
  if (staleFailRes?.result) {
    throw new Error("Stale lease token must not fail reclaimed operation");
  }

  // Worker 2 (active) records recoverable failure with 1 second retry delay
  const [worker2FailRes] = await runtimeSql`
    select logos.fail_durable_operation(
      ${createdOpId}::uuid,
      ${token2}::text,
      'RECOVERABLE_NETWORK_ERROR'::text,
      'Temporary network timeout'::text,
      '1 second'::interval
    ) as result
  `;
  if (!worker2FailRes?.result) {
    throw new Error(
      "fail_durable_operation failed for active live lease token",
    );
  }

  // Verify operation transitioned back to pending with cleared lease
  const [afterFailRow] = await runtimeSql`
    select status, lease_token, failure_code, attempt_count
    from logos.durable_operations
    where id = ${createdOpId}::uuid
  `;
  if (
    afterFailRow?.status !== "pending" ||
    afterFailRow?.lease_token !== null ||
    afterFailRow?.failure_code !== "RECOVERABLE_NETWORK_ERROR" ||
    afterFailRow?.attempt_count !== 2
  ) {
    throw new Error(
      "Operation did not return to pending state after retryable failure",
    );
  }

  // Wait for retry backoff to elapse
  await new Promise((resolve) => setTimeout(resolve, 1100));

  // Worker 3 claims operation (attempt 3 of max 3)
  const claimed3List = await runtimeSql`
    select * from logos.claim_durable_operation('worker-3', '60 seconds'::interval, 100)
  `;
  const claimed3 = claimed3List.find((r) => r.id === createdOpId);
  if (
    !claimed3 ||
    claimed3.status !== "processing" ||
    claimed3.attempt_count !== 3
  ) {
    throw new Error("Worker 3 failed to claim operation on attempt 3");
  }
  const token3 = claimed3.lease_token;

  // Worker 3 records failure on attempt 3 (attempts exhausted >= max_attempts 3)
  const [worker3ExhaustRes] = await runtimeSql`
    select logos.fail_durable_operation(
      ${createdOpId}::uuid,
      ${token3}::text,
      'FATAL_ERROR'::text,
      'Permanent provider rejection'::text,
      '30 seconds'::interval
    ) as result
  `;
  if (!worker3ExhaustRes?.result) {
    throw new Error("fail_durable_operation failed on attempt exhaustion");
  }

  const [exhaustedRow] = await runtimeSql`
    select status, lease_token, completed_at, failure_code
    from logos.durable_operations
    where id = ${createdOpId}::uuid
  `;
  if (
    exhaustedRow?.status !== "failed" ||
    !exhaustedRow?.completed_at ||
    exhaustedRow?.lease_token !== null
  ) {
    throw new Error("Exhausted operation was not marked as permanently failed");
  }

  // 5. Successful Completion Lifecycle Coverage
  const testSuccessKey = `idem-success-${Date.now()}`;
  let successOpId;
  await runtimeSql.begin(async (transaction) => {
    const [op] = await transaction`
      insert into logos.durable_operations (
        correlation_id, audit_event_id, type, idempotency_key, payload, max_attempts
      ) values (
        ${testCorrelationId}::uuid, ${createdBusinessAuditId}::uuid,
        'synthetic_operation', ${testSuccessKey},
        '{"marker": "success_test"}'::jsonb, 3
      )
      returning id
    `;
    successOpId = op?.id;
  });

  const claimedSuccessList = await runtimeSql`
    select * from logos.claim_durable_operation('worker-success', '60 seconds'::interval, 100)
  `;
  const claimedSuccess = claimedSuccessList.find((r) => r.id === successOpId);
  if (!claimedSuccess || !claimedSuccess.lease_token) {
    throw new Error("Failed to claim success test operation");
  }

  const [finalCompleteRes] = await runtimeSql`
    select logos.complete_durable_operation(
      ${successOpId}::uuid,
      ${claimedSuccess.lease_token}::text,
      'succeeded'::logos.operation_status,
      'provider-success-ref',
      null,
      null
    ) as result
  `;
  if (!finalCompleteRes?.result) {
    throw new Error(
      "complete_durable_operation failed for success lifecycle test",
    );
  }

  const [completedRow] = await runtimeSql`
    select status, lease_token, provider_reference, completed_at
    from logos.durable_operations
    where id = ${successOpId}::uuid
  `;
  if (
    completedRow?.status !== "succeeded" ||
    completedRow?.lease_token !== null ||
    completedRow?.provider_reference !== "provider-success-ref" ||
    !completedRow?.completed_at
  ) {
    throw new Error("Operation did not record successful completion properly");
  }

  // --- Phase 04 Identity and Authorization Checks ---
  const [adminIdentity] = await runtimeSql`
    select * from logos.associate_application_identity(
      'synthetic-neon-admin', 'synthetic-google-admin',
      'admin.synthetic@tokyois.com', true, 'tokyois.com'
    )
  `;
  const [pendingIdentity] = await runtimeSql`
    select * from logos.associate_application_identity(
      'synthetic-neon-pending', 'synthetic-google-pending',
      'pending.synthetic@example.test', true, null
    )
  `;
  const [targetIdentity] = await runtimeSql`
    select * from logos.associate_application_identity(
      'synthetic-neon-target', 'synthetic-google-target',
      'target.synthetic@tokyois.com', true, 'tokyois.com'
    )
  `;
  if (
    adminIdentity?.affiliation_status !== "verified" ||
    pendingIdentity?.affiliation_status !== "pending_verification"
  ) {
    throw new Error("Hosted-domain affiliation evidence resolved incorrectly");
  }

  await expectPermissionDenied("runtime raw identity SELECT", async () => {
    await runtimeSql`select * from logos.application_identities`;
  });
  await expectPermissionDenied("runtime raw identity UPDATE", async () => {
    await runtimeSql`update logos.application_identities set active = false`;
  });
  await expectPermissionDenied("runtime bootstrap execution", async () => {
    await runtimeSql`select logos.bootstrap_access_admin(${adminIdentity.identity_id}::uuid, ${createdBusinessAuditId}::uuid)`;
  });

  try {
    await runtimeSql`
      select * from logos.associate_application_identity(
        'synthetic-neon-admin', 'different-google-subject',
        'changed.synthetic@tokyois.com', true, 'tokyois.com'
      )
    `;
    throw new Error("Immutable provider association should have been rejected");
  } catch (error) {
    if (!error.message.includes("immutable identity association mismatch")) {
      throw error;
    }
  }

  const bootstrapAuditId = randomUUID();
  await ownerSql`
    insert into logos.business_audit_journal (
      id, actor_id, actor_type, actor_role_snapshot, source, correlation_id,
      category, action, target_type, target_id, result, reason_code
    ) values (
      ${bootstrapAuditId}::uuid, ${adminIdentity.identity_id}::uuid,
      'user', 'none', 'internal', ${testCorrelationId}::uuid,
      'access', 'bootstrap', 'application_identity', ${adminIdentity.identity_id},
      'success', 'initial_bootstrap'
    )
  `;
  await ownerSql`select logos.bootstrap_access_admin(${adminIdentity.identity_id}::uuid, ${bootstrapAuditId}::uuid)`;
  try {
    await ownerSql`select logos.bootstrap_access_admin(${adminIdentity.identity_id}::uuid, ${bootstrapAuditId}::uuid)`;
    throw new Error("Access bootstrap replay should have been rejected");
  } catch (error) {
    if (!error.message.includes("access bootstrap already consumed"))
      throw error;
  }

  const [adminAccess] = await runtimeSql`
    select * from logos.resolve_identity_access('synthetic-neon-admin')
  `;
  if (adminAccess?.access_level !== "access_admin") {
    throw new Error("Bootstrapped access was not resolved");
  }
  await runtimeSql`
    select logos.set_technical_access(
      ${adminIdentity.identity_id}::uuid,
      ${targetIdentity.identity_id}::uuid,
      'basic'::logos.technical_access_level,
      'synthetic_grant'
    )
  `;
  const [deactivated] = await runtimeSql`
    select logos.deactivate_application_identity(
      ${adminIdentity.identity_id}::uuid,
      ${targetIdentity.identity_id}::uuid,
      'synthetic_deactivation'
    ) as neon_auth_user_id
  `;
  if (deactivated?.neon_auth_user_id !== "synthetic-neon-target") {
    throw new Error(
      "Identity deactivation did not return its provider user ID",
    );
  }
  const [deactivatedAccess] = await runtimeSql`
    select * from logos.resolve_identity_access('synthetic-neon-target')
  `;
  if (deactivatedAccess?.active || deactivatedAccess?.access_level !== null) {
    throw new Error("Deactivation did not immediately deny local access");
  }
  await runtimeSql`
    select logos.set_technical_access(
      ${adminIdentity.identity_id}::uuid,
      ${pendingIdentity.identity_id}::uuid,
      'basic'::logos.technical_access_level,
      'synthetic_grant'
    )
  `.then(
    () => {
      throw new Error("Pending affiliation unexpectedly received access");
    },
    (error) => {
      if (!error.message.includes("target identity is not eligible"))
        throw error;
    },
  );

  const [revoked] = await runtimeSql`
    select logos.revoke_technical_access(
      ${adminIdentity.identity_id}::uuid,
      ${adminIdentity.identity_id}::uuid,
      'synthetic_revoke'
    ) as result
  `;
  if (!revoked?.result) throw new Error("Technical access revocation failed");
  const [afterRevocation] = await runtimeSql`
    select * from logos.resolve_identity_access('synthetic-neon-admin')
  `;
  if (afterRevocation?.access_level !== null) {
    throw new Error("Revoked access remained active");
  }

  // --- Phase 03 Backup Role Checks ---
  const [backupIdentity] = await backupSql`
    select current_user, session_user
  `;
  if (
    backupIdentity?.current_user !== "logos_ci_backup" ||
    backupIdentity?.session_user !== "logos_ci_backup"
  ) {
    throw new Error("Backup tests require a real unprivileged login");
  }

  // Backup role can SELECT on all tables (including audit journals and durable operations)
  const [backupFixture] = await backupSql`
    select marker from logos.infrastructure_probe where id = 1
  `;
  if (backupFixture?.marker !== "logos-phase-02-synthetic") {
    throw new Error("Backup role could not read the synthetic fixture");
  }

  const [backupAudit] = await backupSql`
    select count(*)::integer as count from logos.business_audit_journal
  `;
  if (backupAudit?.count < 1) {
    throw new Error("Backup role could not read business_audit_journal");
  }

  const [backupSecAudit] = await backupSql`
    select count(*)::integer as count from logos.security_audit_journal
  `;
  if (backupSecAudit?.count < 1) {
    throw new Error("Backup role could not read security_audit_journal");
  }

  const [backupOps] = await backupSql`
    select count(*)::integer as count from logos.durable_operations
  `;
  if (backupOps?.count < 1) {
    throw new Error("Backup role could not read durable_operations");
  }

  const [backupIdentities] = await backupSql`
    select count(*)::integer as count from logos.application_identities
  `;
  if (backupIdentities?.count < 2) {
    throw new Error("Backup role could not read Phase 04 identities");
  }

  const [backupApplications] = await backupSql`
    select count(*)::integer as count from logos.student_applications
  `;
  if (backupApplications === undefined) {
    throw new Error("Backup role could not read Phase 06 applications");
  }

  const [backupMembers] = await backupSql`
    select count(*)::integer as count from logos.club_members
  `;
  if (backupMembers === undefined) {
    throw new Error("Backup role could not read Phase 07 club_members");
  }

  const [backupSessions] = await backupSql`
    select count(*)::integer as count from logos.club_sessions
  `;
  if (backupSessions === undefined) {
    throw new Error("Backup role could not read Phase 07 club_sessions");
  }

  const [backupAttendance] = await backupSql`
    select count(*)::integer as count from logos.session_attendance
  `;
  if (backupAttendance === undefined) {
    throw new Error("Backup role could not read Phase 07 session_attendance");
  }

  const [backupAbsences] = await backupSql`
    select count(*)::integer as count from logos.expected_absences
  `;
  if (backupAbsences === undefined) {
    throw new Error("Backup role could not read Phase 07 expected_absences");
  }

  const [backupWarnings] = await backupSql`
    select count(*)::integer as count from logos.member_warnings
  `;
  if (backupWarnings === undefined) {
    throw new Error("Backup role could not read Phase 07 member_warnings");
  }


  await expectPermissionDenied("backup write", async () => {
    await backupSql.begin(async (transaction) => {
      await transaction`
        insert into logos.infrastructure_probe (id, marker)
        values (3, 'must-not-write')
      `;
    });
  });

  await expectPermissionDenied("backup DDL", async () => {
    await backupSql.begin(async (transaction) => {
      await transaction`create table logos.backup_must_not_create (id integer)`;
    });
  });

  console.log("Database role and isolation checks passed.");
} finally {
  await Promise.all([ownerSql.end(), runtimeSql.end(), backupSql.end()]);
}
