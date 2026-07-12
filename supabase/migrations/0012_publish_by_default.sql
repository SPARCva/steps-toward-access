-- v2.7 — submissions go live without an approval step.
-- Both community reports (already instant) and staff-documented barriers now
-- appear on the public record immediately. New barriers are published by
-- default; editors can still unpublish a record from the console if needed.
-- Safe to re-run. Existing rows are unchanged.
alter table public.access_locations alter column published set default true;
