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

  const [backupIdentity] = await backupSql`
    select current_user, session_user
  `;
  if (
    backupIdentity?.current_user !== "logos_ci_backup" ||
    backupIdentity?.session_user !== "logos_ci_backup"
  ) {
    throw new Error("Backup tests require a real unprivileged login");
  }
  const [backupFixture] = await backupSql`
    select marker from logos.infrastructure_probe where id = 1
  `;
  if (backupFixture?.marker !== "logos-phase-02-synthetic") {
    throw new Error("Backup role could not read the synthetic fixture");
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

  await expectPermissionDenied("audit read before Phase 03", async () => {
    await ownerSql.begin(async (transaction) => {
      await transaction`set local role logos_audit`;
      await transaction`select marker from logos.infrastructure_probe`;
    });
  });

  console.log("Database role and isolation checks passed.");
} finally {
  await Promise.all([ownerSql.end(), runtimeSql.end(), backupSql.end()]);
}
