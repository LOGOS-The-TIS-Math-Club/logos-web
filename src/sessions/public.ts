import type postgres from "postgres";

export type PublicSessionSummary = {
  latest: { title: string; description: string } | null;
  termTitles: string[] | null;
};

// Deliberately public projection. Dates, locations, materials, identities, and
// attendance remain behind the existing authenticated calendar operations.
export async function getPublicSessionSummary(
  sql: postgres.Sql,
  asOf = new Date(),
): Promise<PublicSessionSummary> {
  const [row] = await sql<{ summary: PublicSessionSummary }[]>`
    with clock as (select ${asOf.toISOString()}::timestamptz as as_of), current_term as (
      select t.id from meetings.terms t
      join meetings.academic_years y on y.id = t.academic_year_id
      cross join clock
      where t.starts_on <= (clock.as_of at time zone 'Asia/Tokyo')::date
        and t.ends_on > (clock.as_of at time zone 'Asia/Tokyo')::date
        and y.starts_on <= (clock.as_of at time zone 'Asia/Tokyo')::date
        and y.ends_on > (clock.as_of at time zone 'Asia/Tokyo')::date
    )
    select json_build_object(
      'latest', (
        select json_build_object('title', title, 'description', description)
        from meetings.session_times
        where status = 'scheduled' and ends_at <= (select as_of from clock)
        order by starts_at desc, id desc limit 1
      ),
      'termTitles', case when exists (select 1 from current_term) then (
        select coalesce(json_agg(title order by starts_at_local, id), '[]'::json)
        from meetings.sessions
        where term_id in (select id from current_term) and status = 'scheduled'
      ) else null end
    ) as summary`;
  return row.summary;
}
