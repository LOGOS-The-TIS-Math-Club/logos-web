import {
  assertDatabaseIdentity,
  createSqlClient,
  isInsufficientPrivilege,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

requireNonProductionEnvironment();

const testDatabaseUrl = requireEnvironmentVariable("TEST_DATABASE_URL");
const sql = createSqlClient("TEST_DATABASE_URL");

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
  await assertDatabaseIdentity(sql, "TEST_DATABASE_URL", testDatabaseUrl);

  const policyRoles = [
    "logos_migration",
    "logos_runtime",
    "logos_backup",
    "logos_audit",
  ];
  const roles = await sql`
    select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
    from pg_roles
    where rolname in ${sql(policyRoles)}
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

  const [databaseAccess] = await sql`
    select
      has_database_privilege('logos_runtime', current_database(), 'CONNECT') as runtime_connect,
      has_database_privilege('logos_backup', current_database(), 'CONNECT') as backup_connect
  `;
  if (!databaseAccess?.runtime_connect || !databaseAccess?.backup_connect) {
    throw new Error(
      "Runtime and backup roles require explicit database access",
    );
  }

  const [fixture] = await sql`
    select marker from logos.infrastructure_probe where id = 1
  `;
  if (fixture?.marker !== "logos-phase-02-synthetic") {
    throw new Error("Synthetic fixture is missing or unexpected");
  }

  await sql.begin(async (transaction) => {
    await transaction`set local role logos_runtime`;
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
    await sql.begin(async (transaction) => {
      await transaction`set local role logos_runtime`;
      await transaction`create table logos.runtime_must_not_create (id integer)`;
    });
  });

  await expectPermissionDenied("runtime schema creation", async () => {
    await sql.begin(async (transaction) => {
      await transaction`set local role logos_runtime`;
      await transaction`create schema runtime_must_not_create`;
    });
  });

  await sql.begin(async (transaction) => {
    await transaction`set local role logos_backup`;
    const [backupFixture] = await transaction`
      select marker from logos.infrastructure_probe where id = 1
    `;
    if (backupFixture?.marker !== "logos-phase-02-synthetic") {
      throw new Error("Backup role could not read the synthetic fixture");
    }
  });

  await expectPermissionDenied("backup write", async () => {
    await sql.begin(async (transaction) => {
      await transaction`set local role logos_backup`;
      await transaction`
        insert into logos.infrastructure_probe (id, marker)
        values (3, 'must-not-write')
      `;
    });
  });

  await expectPermissionDenied("backup DDL", async () => {
    await sql.begin(async (transaction) => {
      await transaction`set local role logos_backup`;
      await transaction`create table logos.backup_must_not_create (id integer)`;
    });
  });

  await expectPermissionDenied("audit read before Phase 03", async () => {
    await sql.begin(async (transaction) => {
      await transaction`set local role logos_audit`;
      await transaction`select marker from logos.infrastructure_probe`;
    });
  });

  console.log("Database role and isolation checks passed.");
} finally {
  await sql.end();
}
