-- Steps Toward Access v2.1 — real coordinates + publish checklist.
-- Paste into Supabase SQL Editor → Run. Safe to re-run.

alter table public.access_locations
  add column if not exists lat numeric,   -- WGS84 latitude
  add column if not exists lon numeric,   -- WGS84 longitude
  -- publish checklist (recorded, and enforced below before publishing):
  add column if not exists redaction_reviewed boolean not null default false,
  add column if not exists legal_signoff_by   text,
  add column if not exists legal_signoff_at   timestamptz;

-- Publishing now requires the checklist: correspondence redaction reviewed
-- AND legal sign-off recorded (CEO approval per SPARC policy). Editors only,
-- as before; every flip still lands in the audit log.
create or replace function public.access_guard_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.published is distinct from old.published then
    if public.access_role() not in ('editor','admin') then
      raise exception 'Only editors can publish or unpublish a barrier.';
    end if;
    if new.published and not new.redaction_reviewed then
      raise exception 'Publish blocked: correspondence redaction has not been reviewed.';
    end if;
    if new.published and (new.legal_signoff_by is null or btrim(new.legal_signoff_by) = '') then
      raise exception 'Publish blocked: legal sign-off has not been recorded.';
    end if;
    insert into public.access_audit_log (actor_email, action, entity, entity_id, detail)
    values (auth.jwt()->>'email',
            case when new.published then 'publish' else 'unpublish' end,
            'access_locations', new.id,
            jsonb_build_object('label', new.label, 'signoff', new.legal_signoff_by));
  end if;
  return new;
end;
$$;
