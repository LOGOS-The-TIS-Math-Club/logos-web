-- Central defaults and an explicit public projection. Existing sessions are independent.
create table meetings.recurring_settings (
  id boolean primary key default true check (id),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  room text not null default '' check (length(room) <= 120),
  published boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
