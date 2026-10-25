import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import {
  type Row,
  type Tables,
  type Decisions,
  type Finding,
  stableId,
  tokyoDate,
  academicYear,
  assertImport,
  hash,
} from "./model.ts";

export async function buildPlan(
  source: Tables,
  backup: string,
  decisions: Decisions,
) {
  const target: Tables = {};
  const findings: Finding[] = [];
  const mapping: Row = {
    identities: [],
    members: [],
    applications: [],
    sessions: [],
    attendance: [],
    images: [],
    providerLinks: [],
  };
  const put = (table: string, row: Row) => (target[table] ??= []).push(row);
  const identities = source["people.application_identities"];
  const members = source["members.club_members"];
  const apps = source["applications.student_applications"];
  const byId = (rows: Row[]) => new Map(rows.map((r) => [r.id, r]));
  const identityById = byId(identities),
    memberById = byId(members),
    appById = byId(apps);
  const evidence = source["people.affiliation_evidence"];
  assertImport(
    new Set(members.map((m) => m.identity_id)).size === members.length,
    "Duplicate legacy membership identities require a reviewed merge mapping",
  );
  const years = new Set<number>();
  const imageReferences = new Map<string, string>();
  for (const i of identities) {
    const proof = evidence.some(
      (e) =>
        e.identity_id === i.id &&
        e.status === "verified" &&
        e.evidence_type === "google_hd" &&
        e.hosted_domain === "tokyois.com",
    );
    const verified =
      i.email_verified &&
      i.affiliation_status === "verified" &&
      proof &&
      /^[^@\s]+@tokyois\.com$/i.test(i.email);
    put("people.identities", {
      id: i.id,
      auth_user_id: null,
      google_subject: i.google_subject,
      email: i.email,
      school_verified: Boolean(verified),
      enabled: i.active,
      created_at: i.created_at,
      updated_at: i.updated_at,
      profile_image_id: null,
    });
    mapping.identities.push({ sourceId: i.id, targetId: i.id });
    mapping.providerLinks.push({
      identityId: i.id,
      legacyAuthUserId: i.neon_auth_user_id,
      googleSubject: i.google_subject,
    });
    if (!verified)
      findings.push({
        kind: "identity_verification",
        ids: [i.id],
        detail:
          "School verification not established from matching legacy Google evidence.",
        blocksCutover: true,
      });
  }
  for (const m of members) {
    const app = appById.get(m.application_id);
    assertImport(
      app && app.identity_id === m.identity_id,
      `Missing or mismatched membership application: ${m.id}`,
    );
    const grade = Number((m.grade_override || app.grade).replace("Grade ", ""));
    assertImport(
      Number.isInteger(grade) && grade >= 9 && grade <= 12,
      `Grade override requires review: ${m.id}`,
    );
    const year = m.grade_override
      ? academicYear(tokyoDate(m.updated_at))
      : (m.cohort_year ?? academicYear(tokyoDate(app.submitted_at)));
    years.add(year);
    const name = m.display_name || m.roster_name || app.preferred_name;
    put("members.memberships", {
      id: m.id,
      identity_id: m.identity_id,
      display_name: name,
      grade,
      grade_academic_year: year,
      created_at: m.joined_at,
      updated_at: m.updated_at,
    });
    const notes = [
      m.roster_name && m.roster_name !== name
        ? `Legacy administrative roster name: ${m.roster_name}`
        : "",
      m.status_reason ? `Legacy membership reason: ${m.status_reason}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    put("members.private_notes", { member_id: m.id, notes });
    const joined = tokyoDate(m.joined_at);
    put("members.state_changes", {
      member_id: m.id,
      effective_on: joined,
      status: "active",
      departure_reason: null,
      recorded_by: m.created_by_identity_id,
      recorded_at: m.joined_at,
    });
    if (m.status !== "active") {
      assertImport(m.left_at, `Missing departure date: ${m.id}`);
      const reason = decisions.formerReasons[m.id];
      assertImport(
        m.status === "former" && reason,
        `Unresolved membership state/reason: ${m.id}`,
      );
      assertImport(
        tokyoDate(m.left_at) > joined,
        `Same-day or reversed membership dates require review: ${m.id}`,
      );
      const history = source["operations.business_audit_journal"].find(
        (e) =>
          e.target_id === m.id &&
          e.action === "status_update" &&
          e.after_summary?.status === m.status,
      );
      put("members.state_changes", {
        member_id: m.id,
        effective_on: tokyoDate(m.left_at),
        status: "former",
        departure_reason: reason,
        recorded_by: history?.actor_id || m.created_by_identity_id,
        recorded_at: m.left_at,
      });
    }
    put("people.role_grants", {
      identity_id: m.identity_id,
      role: "member",
      granted_by: m.created_by_identity_id,
      granted_at: m.joined_at,
    });
    mapping.members.push({
      sourceId: m.id,
      targetId: m.id,
      joinedOn: joined,
      leftOn: m.left_at ? tokyoDate(m.left_at) : null,
      sourceStatus: m.status,
    });
  }
  for (const a of apps) {
    const member = members.find((m) => m.application_id === a.id);
    const year = academicYear(tokyoDate(a.submitted_at));
    years.add(year);
    assertImport(
      a.status !== "accepted" || member,
      `Accepted application without membership: ${a.id}`,
    );
    put("applications.submissions", {
      id: a.id,
      identity_id: a.identity_id,
      preferred_name: a.preferred_name,
      grade: Number(a.grade.replace("Grade ", "")),
      grade_academic_year: year,
      academic_interests: a.academic_interests,
      join_reason: a.join_reason,
      goals: a.goals,
      experience: a.experience,
      math_course: a.math_course,
      contest_interest: a.contest_interest,
      present_interest: a.present_interest,
      attendance_confirmation: a.attendance_confirmation,
      accuracy_acknowledged: a.accuracy_acknowledged,
      status:
        (
          { reviewing: "under_review", declined: "rejected" } as Record<
            string,
            string
          >
        )[a.status] || a.status,
      member_id: a.status === "accepted" ? member!.id : null,
      status_reason: a.status_reason,
      reviewed_by: a.reviewed_by_identity_id,
      submitted_at: a.submitted_at,
      status_updated_at: a.status_updated_at,
    });
    mapping.applications.push({
      sourceId: a.id,
      targetId: a.id,
      memberId: member?.id ?? null,
    });
  }
  for (const s of source["meetings.club_sessions"]) {
    const year = academicYear(s.session_date);
    years.add(year);
    assertImport(
      /^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time),
      `Unparseable session time: ${s.id}`,
    );
    const minutes = (time: string) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const duration = minutes(s.end_time) - minutes(s.start_time);
    assertImport(
      duration > 0 && duration <= 1440,
      `Ambiguous overnight or invalid session duration: ${s.id}`,
    );
    const term = decisions.terms.find(
      (t) =>
        t.academicYear === year &&
        t.startsOn <= s.session_date &&
        s.session_date < t.endsOn,
    );
    let folder = null;
    if (s.drive_folder_id) {
      if (decisions.approvedMaterialsFolders.includes(s.drive_folder_id))
        folder = `https://drive.google.com/drive/folders/${s.drive_folder_id}`;
      else
        findings.push({
          kind: "materials_folder_unreviewed",
          ids: [s.id],
          detail:
            "Unverified folder omitted; original preserved in private source.",
          blocksCutover: true,
        });
    }
    put("meetings.sessions", {
      id: s.id,
      academic_year_id: stableId(`year:${year}`),
      term_id: term?.id ?? null,
      starts_at_local: `${s.session_date}T${s.start_time}:00`,
      duration_minutes: duration,
      title: s.title,
      description: s.notes ?? "",
      location: s.location,
      materials_folder_url: folder,
      status: "scheduled",
      created_at: s.created_at,
      updated_at: s.updated_at,
      created_by: s.created_by_identity_id,
    });
    mapping.sessions.push({
      sourceId: s.id,
      targetId: s.id,
      academicYear: year,
      termId: term?.id ?? null,
    });
  }
  for (const year of [...years].sort())
    put("meetings.academic_years", {
      id: stableId(`year:${year}`),
      name: `${year}–${String(year + 1).slice(2)}`,
      start_year: year,
      starts_on: `${year}-08-01`,
      ends_on: `${year + 1}-08-01`,
    });
  for (const t of decisions.terms) {
    assertImport(
      years.has(t.academicYear),
      "Configured term references absent academic year",
    );
    put("meetings.terms", {
      id: t.id,
      academic_year_id: stableId(`year:${t.academicYear}`),
      name: t.name,
      starts_on: t.startsOn,
      ends_on: t.endsOn,
    });
  }
  const unassigned = (target["meetings.sessions"] ?? [])
    .filter((s) => !s.term_id)
    .map((s) => s.id);
  if (unassigned.length)
    findings.push({
      kind: "term_configuration_pending",
      ids: unassigned,
      detail:
        "Sessions retained under their academic year. Admin must define real terms and assign these sessions.",
      blocksCutover: true,
    });
  const sessionById = byId(source["meetings.club_sessions"]);
  for (const a of source["meetings.session_attendance"]) {
    const m = memberById.get(a.member_id),
      s = sessionById.get(a.session_id);
    assertImport(m && s, `Broken attendance relationship: ${a.id}`);
    put("meetings.attendance", {
      member_id: a.member_id,
      session_id: a.session_id,
      status: a.status,
      notes: a.notes,
      recorded_by: a.recorded_by_identity_id,
      recorded_at: a.recorded_at,
      updated_at: a.updated_at,
    });
    const outside =
      s.session_date < tokyoDate(m.joined_at) ||
      (m.left_at && s.session_date >= tokyoDate(m.left_at));
    if (outside)
      findings.push({
        kind: "attendance_outside_membership",
        ids: [a.id, m.id, s.id],
        detail: `${a.status}: preserved in ledger, excluded from percentage; membership dates unchanged.`,
        blocksCutover: true,
      });
    mapping.attendance.push({
      sourceId: a.id,
      memberId: a.member_id,
      sessionId: a.session_id,
    });
  }
  for (const n of source["meetings.expected_absences"]) {
    let sessionId = n.session_id;
    if (
      n.session_id &&
      sessionById.get(n.session_id)?.session_date !== n.session_date
    ) {
      assertImport(
        Object.hasOwn(decisions.absenceSessionOverrides, n.id),
        `Absence link decision required: ${n.id}`,
      );
      sessionId = decisions.absenceSessionOverrides[n.id];
      assertImport(
        sessionId === null ||
          sessionById.get(sessionId)?.session_date === n.session_date,
        `Replacement absence session must match notice date: ${n.id}`,
      );
      findings.push({
        kind: "absence_link_corrected",
        ids: [n.id, n.session_id, ...(sessionId ? [sessionId] : [])],
        detail: sessionId
          ? "Explicitly relinked to the session matching the original notice date."
          : "Original notice date retained without a session link pending review.",
        blocksCutover: sessionId === null,
      });
    }
    put("meetings.absence_notices", {
      id: n.id,
      member_id: n.member_id,
      session_id: sessionId,
      session_date: sessionId ? null : n.session_date,
      reason: n.reason,
      status: n.status,
      submitted_by: n.submitted_by_identity_id,
      created_at: n.created_at,
      updated_at: n.updated_at,
    });
    (mapping.absenceNotices ??= []).push({
      sourceId: n.id,
      targetId: n.id,
      originalSessionId: n.session_id,
      originalDate: n.session_date,
      targetSessionId: sessionId,
    });
  }
  for (const image of source["content.images"]) {
    const bytes = Buffer.from(image.data.slice(2), "hex");
    assertImport(
      bytes.length === image.byte_size,
      `Image byte size mismatch: ${image.id}`,
    );
    put("content.images", {
      id: image.id,
      mime_type: image.mime_type,
      data: image.data,
      alt_text: image.alt_text,
      width: image.width,
      height: image.height,
      uploaded_by: image.uploaded_by_identity_id,
      created_at: image.created_at,
    });
    mapping.images.push({
      sourceId: image.id,
      targetId: image.id,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const assets: Row[] = JSON.parse(
    await readFile(resolve(backup, "external-assets-map.json"), "utf8"),
  );
  const users: Row[] = source["authUsers"];
  for (const asset of assets.filter((a) => a.status === "saved")) {
    const path = resolve(backup, asset.file),
      rel = relative(backup, path);
    assertImport(
      !rel.startsWith("..") && !isAbsolute(rel),
      "Asset path escapes backup",
    );
    const bytes = await readFile(path);
    assertImport(
      bytes.length === asset.bytes &&
        createHash("sha256").update(bytes).digest("hex") === asset.sha256,
      "External image checksum mismatch",
    );
    const id = stableId(`profile-image:${asset.sha256}`);
    if (!target["content.images"].some((i) => i.id === id))
      put("content.images", {
        id,
        mime_type: asset.mime_type,
        data: `\\x${bytes.toString("hex")}`,
        alt_text: "Profile photo",
        width: null,
        height: null,
        uploaded_by: null,
        created_at: asset.retrieval_time_utc,
      });
    imageReferences.set(asset.reference, id);
    mapping.images.push({
      sourceFile: asset.file,
      targetId: id,
      sha256: asset.sha256,
    });
  }
  for (const i of identities) {
    const user = users.find((u) => u.id === i.neon_auth_user_id);
    const account = source["authAccounts"].find(
      (a) => a.userId === i.neon_auth_user_id && a.providerId === "google",
    );
    assertImport(
      user &&
        account &&
        account.accountId === i.google_subject &&
        user.emailVerified &&
        user.email.toLowerCase() === i.email.toLowerCase(),
      `Hosted Auth identity reconciliation mismatch: ${i.id}`,
    );
    const image = user.image ? imageReferences.get(user.image) : null;
    assertImport(!user.image || image, `Unbacked profile image: ${i.id}`);
    target["people.identities"].find((t) => t.id === i.id)!.profile_image_id =
      image ?? null;
    mapping.providerLinks.find(
      (p: Row) => p.identityId === i.id,
    ).profileImageId = image ?? null;
  }
  for (const r of source["content.club_resources"].filter(
    (r) => new URL(r.url).hostname === "drive.google.com",
  ))
    findings.push({
      kind: "legacy_resource_access_unverified",
      ids: [r.id],
      detail:
        "Original Drive resource URL preserved, but backed-up access failed. Not assigned to session materials; contents and sharing remain unverified.",
      blocksCutover: true,
    });
  for (const a of source["content.announcements"])
    put("content.announcements", {
      id: a.id,
      title: a.title,
      body: a.body,
      image_id: a.image_id,
      published_at: a.published ? a.published_at : null,
      created_by: a.created_by_identity_id,
      created_at: a.created_at,
      updated_at: a.updated_at,
    });
  for (const s of source["content.story_entries"])
    put("content.stories", {
      id: s.id,
      title: s.title,
      occurred_on: s.occurred_on,
      description: s.body,
      image_id: s.image_id,
      published: s.published,
      created_by: s.created_by_identity_id,
      created_at: s.created_at,
      updated_at: s.updated_at,
    });
  for (const r of source["content.club_resources"])
    put("content.resource_links", {
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
      sort_order: r.sort_order,
      created_by: r.created_by_identity_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  for (const id of decisions.approvedAdminIdentityIds) {
    assertImport(identityById.has(id), `Unknown admin identity: ${id}`);
    put("people.role_grants", {
      identity_id: id,
      role: "admin",
      granted_by: null,
      granted_at: source.snapshotAt[0].value,
    });
  }
  const unreviewedAdmins = source["people.technical_access_assignments"]
    .filter(
      (a) =>
        !a.revoked_at &&
        !decisions.approvedAdminIdentityIds.includes(a.identity_id),
    )
    .map((a) => a.identity_id);
  if (unreviewedAdmins.length)
    findings.push({
      kind: "admin_grants_pending",
      ids: unreviewedAdmins,
      detail:
        "No legacy technical role automatically grants admin. Explicit leader approval required; club account grant follows the stated requirement.",
      blocksCutover: true,
    });
  const history = source["operations.business_audit_journal"];
  for (const e of history) {
    if (!identityById.has(e.actor_id)) continue;
    const details = {
      legacyEventId: e.id,
      targetType: e.target_type,
      before: e.before_summary,
      after: e.after_summary,
      metadata: e.metadata,
      reasonCode: e.reason_code,
    };
    put("operations.change_history", {
      actor_id: e.actor_id,
      action: `legacy.${e.target_type}.${e.action}`,
      entity_id: e.target_id,
      details,
      recorded_at: e.recorded_at,
    });
  }
  for (const e of history.filter((e) => e.action === "delete"))
    findings.push({
      kind: "source_deleted_record",
      ids: [e.target_id],
      detail: `Legacy ${e.target_type} deletion is retained as history; source row was already absent from backup.`,
      blocksCutover: e.target_type === "club_session",
    });
  assertImport(
    source["members.member_warnings"].length === 0,
    "Warning import mapping needs implementation for a nonempty source",
  );
  findings.push({
    kind: "hosted_auth_link_pending",
    ids: identities.map((i) => i.id),
    detail:
      "Stable Google subjects retained; new auth_user_id remains null. Hosted sessions/tokens/keys were not imported.",
    blocksCutover: true,
  });
  return { target, findings, mapping, decisionHash: hash(decisions) };
}
