-- Steps Toward Access v2.1 (REVISED — supersedes the earlier 0005).
-- Run this whether or not the earlier 0005 was run; it is safe both ways.
-- Changes: real coordinates for map pins; Kat and Debi added as editors;
-- publish requires ONLY the editor role (no checklist enforcement).

-- real coordinates for pins (idempotent)
alter table public.access_locations
  add column if not exists lat numeric,
  add column if not exists lon numeric,
  -- optional, non-enforced record-keeping fields (fine to ignore):
  add column if not exists redaction_reviewed boolean not null default false,
  add column if not exists legal_signoff_by   text,
  add column if not exists legal_signoff_at   timestamptz;

-- publishers: Kat, Debi, Erica, grants
insert into public.access_staff (email, role, display_name) values
  ('kat@sparcsolutions.org',  'editor', 'Kat Rader'),
  ('debi@sparcsolutions.org', 'editor', 'Debi Alexander')
on conflict (email) do update set role = excluded.role;

-- publish guard: editor-only + audit log. NO checklist conditions.
create or replace function public.access_guard_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.published is distinct from old.published then
    if public.access_role() not in ('editor','admin') then
      raise exception 'Only editors can publish or unpublish a barrier.';
    end if;
    insert into public.access_audit_log (actor_email, action, entity, entity_id, detail)
    values (auth.jwt()->>'email',
            case when new.published then 'publish' else 'unpublish' end,
            'access_locations', new.id,
            jsonb_build_object('label', new.label));
  end if;
  return new;
end;
$$;
