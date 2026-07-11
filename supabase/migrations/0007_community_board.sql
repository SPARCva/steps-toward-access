-- Accessibility in Real Time v2.3 — public community board.
-- Community reports become publicly visible ONCE a staff member flips
-- shown_publicly (one click in the console). Reporter identity is never
-- exposed: the public reads through a view that carries only safe columns.
-- Safe to re-run.

alter table public.access_public_reports
  add column if not exists shown_publicly boolean not null default false,
  add column if not exists shown_at timestamptz;

-- Public read path: a view with only the safe columns.
-- (security_invoker off => the view itself is the boundary; it filters rows
--  and selects columns. The base table stays insert-only for anon.)
create or replace view public.access_community_board
with (security_invoker = off) as
  select id, barrier_type, barrier_desc, place_desc, lat, lon,
         status, created_at
  from public.access_public_reports
  where shown_publicly;

grant select on public.access_community_board to anon, authenticated;

comment on view public.access_community_board is
  'Public, staff-approved community reports. Excludes reporter identity, contact info, party accusations, and team notes by design.';
