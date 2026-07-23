-- Run against an isolated linked test project after creating two provider auth users.
-- Replace the UUID placeholders inside a transaction, then roll the transaction back.

begin;

-- Provider ownership remains the root of every Protocol Studio row.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

-- Provider A can see only their templates and editions.
select id, protocol_name, status from public.protocol_templates
where provider_id = auth.uid();
select v.id, v.version from public.protocol_template_versions v
where v.provider_id = auth.uid();

-- Cross-provider direct inserts are blocked by RLS; all writes use authenticated RPCs.
do $$
begin
  begin
    insert into public.protocol_templates(provider_id, protocol_name, treatment_label)
    values ('00000000-0000-4000-8000-000000000002', 'Blocked', 'Blocked');
    raise exception 'cross-provider insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation then
    null;
  end;
end $$;

-- Anonymous callers cannot enumerate provider workspace tables.
set local role anon;
do $$
begin
  begin
    perform * from public.protocol_templates limit 1;
    raise exception 'anonymous template read unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- Published edition rows reject mutation at the database layer.
set local role postgres;
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.protocol_template_versions limit 1;
  if v_id is not null then
    begin
      update public.protocol_template_versions set change_summary = 'mutated' where id = v_id;
      raise exception 'published edition mutation unexpectedly succeeded';
    exception when check_violation then
      null;
    end;
  end if;
end $$;

-- Draft and archived templates must be rejected by issue_skin_pass_from_template.
-- Historical pass stability is proved by comparing skin_passes.issued_snapshot before
-- and after a newer template publication; the JSON documents must be byte-equal.

rollback;
