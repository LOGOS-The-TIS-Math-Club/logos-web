import type postgres from "postgres";
import {
  type Tables,
  type Row,
  sourceNames,
  assertImport,
  canonical,
  hash,
  tokyoDate,
} from "./model.ts";
import {
  attendanceSummary,
  type AttendanceStatus,
} from "../../src/attendance/summary.ts";

export async function loadSource(sql: postgres.Sql): Promise<Tables> {
  const source: Tables = {};
  for (const name of sourceNames) {
    source[name] = (
      await sql.unsafe(`SELECT to_jsonb(t) AS row FROM ${identifier(name)} t`)
    ).map((r) => r.row);
  }
  // Only whitelist the provider fields needed for reconciliation. Tokens, keys,
  // passwords, sessions, and hosted configuration never enter the import plan.
  source.authUsers = (
    await sql`select jsonb_build_object('id',id,'email',email,'emailVerified',"emailVerified",'image',image) as row from neon_auth."user"`
  ).map((r) => r.row);
  source.authAccounts = (
    await sql`select jsonb_build_object('userId',"userId",'accountId',"accountId",'providerId',"providerId") as row from neon_auth.account`
  ).map((r) => r.row);
  return source;
}
function identifier(value: string): string {
  assertImport(
    /^[a-z_]+(\.[a-z_]+)?$/.test(value),
    "Invalid import SQL identifier",
  );
  return value
    .split(".")
    .map((v) => `"${v}"`)
    .join(".");
}
const order = [
  "people.identities",
  "meetings.academic_years",
  "meetings.terms",
  "members.memberships",
  "members.private_notes",
  "members.state_changes",
  "applications.submissions",
  "people.role_grants",
  "meetings.sessions",
  "meetings.attendance",
  "meetings.absence_notices",
  "content.images",
  "content.announcements",
  "content.stories",
  "content.resource_links",
  "operations.change_history",
];
export async function importPlan(sql: postgres.Sql, target: Tables) {
  await sql.begin(async (tx) => {
    assertImport(
      (await tx`select count(*)::int as n from people.identities`)[0].n === 0,
      "Import target must be empty",
    );
    // Only this initial-submission guard is disabled, in this transaction and
    // only in the freshly created local database. FKs/CHECKs remain enabled.
    await tx`alter table applications.submissions disable trigger submission_guard`;
    for (const table of order)
      for (const expected of target[table] ?? []) {
        const row = expected;
        const columns = Object.keys(row).map(identifier).join(",");
        await tx.unsafe(
          `INSERT INTO ${identifier(table)} (${columns}) SELECT ${columns} FROM jsonb_populate_record(NULL::${identifier(table)},$1::text::jsonb)`,
          [JSON.stringify(row)],
        );
      }
    await tx`alter table applications.submissions enable trigger submission_guard`;
  });
}
export async function verifyImport(
  sql: postgres.Sql,
  source: Tables,
  target: Tables,
  snapshot: string,
) {
  const content: Row = {};
  for (const [table, expected] of Object.entries(target)) {
    const columns = Object.keys(expected[0] ?? {});
    const projected = (row: Row) =>
      Object.fromEntries(columns.map((k) => [k, row[k]]));
    const normalize: Row[] = [];
    for (const row of expected)
      normalize.push(
        projected(
          (
            await sql.unsafe(
              `SELECT to_jsonb(x) as row FROM jsonb_populate_record(NULL::${identifier(table)},$1::text::jsonb) x`,
              [JSON.stringify(row)],
            )
          )[0].row,
        ),
      );
    const actual = (
      await sql.unsafe(`SELECT to_jsonb(t) as row FROM ${identifier(table)} t`)
    ).map((r) => projected(r.row));
    const sort = (rows: Row[]) => rows.map(canonical).sort();
    assertImport(
      canonical(sort(actual)) === canonical(sort(normalize)),
      `Transformed row content mismatch: ${table}`,
    );
    content[table] = {
      rows: actual.length,
      sha256: hash(sort(actual)),
      verifiedFields: columns,
    };
  }
  const checks: Row = {};
  const [triggers] =
    await sql`select bool_and(tgenabled='O') as enabled from pg_trigger where tgname='submission_guard'`;
  assertImport(triggers.enabled, "Submission guard was not restored");
  checks.submissionGuardRestored = true;
  const noticeCount = target["meetings.absence_notices"]?.length ?? 0;
  assertImport(
    noticeCount === source["meetings.expected_absences"].length,
    "Absence notice lost during classification",
  );
  checks.absenceNoticesAccountedFor = noticeCount;

  const [fk] =
    await sql`select count(*)::int as invalid from pg_constraint where contype in ('f','c') and connamespace in (select oid from pg_namespace where nspname in ('people','members','applications','meetings','content','operations')) and not convalidated`;
  assertImport(fk.invalid === 0, "Unvalidated domain constraints");
  checks.constraintsValidated = true;
  const [mismatch] =
    await sql`select count(*)::int as n from applications.submissions a join members.memberships m on m.id=a.member_id where a.identity_id<>m.identity_id`;
  assertImport(mismatch.n === 0, "Application/member identity mismatch");
  checks.applicationMemberIdentity = true;
  const [profiles] =
    await sql`select count(*)::int as n from people.identities i join content.images p on p.id=i.profile_image_id`;
  assertImport(
    profiles.n === source.authUsers.filter((u) => u.image).length,
    "Lost profile image relationship",
  );
  checks.profileImageReferences = profiles.n;
  const [stories] =
    await sql`select count(*)::int as n from content.stories s join content.images i on i.id=s.image_id`;
  assertImport(
    stories.n ===
      source["content.story_entries"].filter((s) => s.image_id).length,
    "Lost Story image relationship",
  );
  checks.storyImageReferences = stories.n;
  checks.noHostedAuthTables = (
    await sql`select to_regnamespace('neon_auth') is null as absent`
  )[0].absent;
  assertImport(
    checks.noHostedAuthTables,
    "Hosted auth tables copied into target",
  );
  checks.noLinkedAuthUserIds =
    (
      await sql`select count(*)::int as n from people.identities where auth_user_id is not null`
    )[0].n === 0;
  assertImport(
    checks.noLinkedAuthUserIds,
    "Hosted Auth IDs linked without reconciliation",
  );
  for (const session of source["meetings.club_sessions"]) {
    const [time] =
      await sql`select starts_at = ${`${session.session_date}T${session.start_time}:00+09:00`}::text::timestamptz as start_correct,
      ends_at = ${`${session.session_date}T${session.end_time}:00+09:00`}::text::timestamptz as end_correct
      from meetings.session_times where id=${session.id}`;
    assertImport(
      time.start_correct && time.end_correct,
      `Session instant differs from Tokyo source time: ${session.id}`,
    );
  }
  checks.tokyoSessionInstants = source["meetings.club_sessions"].length;
  const results: Row[] = [];
  const sessions = source["meetings.club_sessions"];
  const attendance = source["meetings.session_attendance"];
  const ms = source["members.club_members"];
  for (const member of ms) {
    const start = tokyoDate(member.joined_at),
      end = member.left_at ? tokyoDate(member.left_at) : null;
    const eligible = sessions.filter(
      (s) =>
        s.session_date >= start &&
        (!end || s.session_date < end) &&
        new Date(`${s.session_date}T${s.end_time}:00+09:00`).getTime() <=
          new Date(snapshot).getTime(),
    );
    const expectedStatuses = eligible.map(
      (s) =>
        attendance.find(
          (a) => a.member_id === member.id && a.session_id === s.id,
        )?.status ?? "unmarked",
    );
    const numerator = expectedStatuses.filter(
      (s) => s === "present" || s === "late",
    ).length;
    const denominator =
      numerator +
      expectedStatuses.filter((s) => s === "unexcused_absence").length;
    const percentage = denominator
      ? Math.round((numerator / denominator) * 100)
      : null;
    const rows = await sql<
      { session_id: string; status: AttendanceStatus }[]
    >`select * from meetings.eligible_attendance(${member.id},${snapshot}::text::timestamptz)`;
    assertImport(
      canonical(rows.map((r) => r.session_id).sort()) ===
        canonical(eligible.map((s) => s.id).sort()),
      `Eligible session IDs disagree for ${member.id}`,
    );
    const actual = attendanceSummary(rows);
    assertImport(
      actual.attended === numerator &&
        actual.denominator === denominator &&
        actual.percentage === percentage,
      `Attendance calculation mismatch for ${member.id}`,
    );
    const outside = attendance.filter(
      (a) =>
        a.member_id === member.id &&
        !eligible.some((s) => s.id === a.session_id),
    );
    const review = outside.some(
      (a) => sessions.find((s) => s.id === a.session_id)!.session_date < start,
    );
    results.push({
      memberId: member.id,
      displayName: target["members.memberships"].find(
        (m) => m.id === member.id,
      )!.display_name,
      email: source["people.application_identities"].find(
        (i) => i.id === member.identity_id,
      )!.email,
      joinedOn: start,
      leftOn: end,
      eligibleSessionIds: eligible.map((s) => s.id).sort(),
      ...actual,
      previewPercentage: percentage,
      percentage: review ? null : percentage,
      requiresDateReview: review,
      excludedLedgerIds: outside.map((a) => a.id),
      excludedRecords: outside.map((a) => ({
        attendanceId: a.id,
        sessionId: a.session_id,
        sessionDate: sessions.find((s) => s.id === a.session_id)!.session_date,
        status: a.status,
        recordedAt: a.recorded_at,
      })),
    });
    const [access] =
      await sql`select people.has_access(${member.identity_id},'member',${tokyoDate(snapshot)}::text::date) as allowed`;
    assertImport(
      access.allowed === (member.status === "active"),
      `Member access mismatch for ${member.id}`,
    );
  }
  checks.membershipEligibilityAndAccess = ms.length;
  // Local PostgreSQL cannot validate a live Google login or Drive permission.
  return { content, checks, attendance: results };
}
