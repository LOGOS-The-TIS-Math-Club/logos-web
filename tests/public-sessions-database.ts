import assert from "node:assert/strict";
import type postgres from "postgres";
import { getPublicSessionSummary } from "../src/sessions/public.ts";

// Run only inside the existing disposable database harness, after its reset.
export async function verifyPublicSessions(sql: postgres.Sql) {
  const asOf = new Date("2026-10-31T15:00:00Z"); // Nov 1, midnight in Tokyo.
  assert.deepEqual(await getPublicSessionSummary(sql, asOf), {
    latest: null,
    termTitles: null,
  });
  const [year] =
    await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on)
    values ('Public summary test',2026,'2026-08-01','2027-08-01') returning id`;
  const [previous] =
    await sql`insert into meetings.terms(academic_year_id,name,starts_on,ends_on)
    values (${year.id},'Previous','2026-08-01','2026-11-01') returning id`;
  const [current] =
    await sql`insert into meetings.terms(academic_year_id,name,starts_on,ends_on)
    values (${year.id},'Current','2026-11-01','2027-08-01') returning id`;
  assert.deepEqual((await getPublicSessionSummary(sql, asOf)).termTitles, []);
  await sql`insert into meetings.sessions(term_id,starts_at_local,duration_minutes,title,description,location,materials_folder_url,status)
    values
    (${previous.id},'2026-10-31 22:00',60,'Latest completed','Public description','PRIVATE ROOM','https://drive.google.com/drive/folders/PRIVATE','scheduled'),
    (${previous.id},'2026-10-31 23:00',30,'Cancelled must stay hidden','Cancelled','',null,'cancelled'),
    (${previous.id},'2026-10-31 23:45',60,'In progress','Not completed','',null,'scheduled'),
    (${current.id},'2026-11-02 15:30',60,'Second session','Private future description','',null,'scheduled'),
    (${current.id},'2026-11-01 15:30',60,'First session','Private future description','',null,'scheduled'),
    (${current.id},'2026-11-03 15:30',60,'Cancelled future','Hidden','',null,'cancelled')`;
  const expected = {
    latest: { title: "Latest completed", description: "Public description" },
    termTitles: ["First session", "Second session"],
  };
  const summary = await getPublicSessionSummary(sql, asOf);
  assert.deepEqual(summary, expected);
  const beforeBoundary = await getPublicSessionSummary(
    sql,
    new Date("2026-10-31T14:59:59Z"),
  );
  assert.deepEqual(beforeBoundary.termTitles, [
    "Latest completed",
    "In progress",
  ]);
  const output = JSON.stringify(summary);
  assert.ok(!output.includes("PRIVATE"));
  assert.ok(!output.includes("Private future description"));
  await sql`delete from meetings.sessions where academic_year_id=${year.id}`;
  await sql`delete from meetings.terms where academic_year_id=${year.id}`;
  await sql`delete from meetings.academic_years where id=${year.id}`;
}
