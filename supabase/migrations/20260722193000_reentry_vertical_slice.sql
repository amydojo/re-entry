create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.skin_pass_status as enum ('draft', 'issued', 'revoked', 'expired');
create type public.pass_item_kind as enum ('product', 'activity');
create type public.pass_inventory_group as enum ('routine', 'activity');
create type public.pass_audit_action as enum (
  'pass_issued', 'pass_opened', 'item_checked', 'protocol_updated', 'pass_revoked', 'link_copied'
);

create table public.provider_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Provider',
  studio_name text not null default 'RE:ENTRY Provider',
  mobile text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.treatment_protocol_templates (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.provider_profiles(id) on delete cascade,
  treatment_key text not null,
  treatment_name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique nulls not distinct (provider_id, treatment_key)
);

create table public.treatment_protocol_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.treatment_protocol_templates(id) on delete cascade,
  item_key text not null,
  item_label text not null,
  kind public.pass_item_kind not null,
  inventory_group public.pass_inventory_group not null,
  baseline_available boolean not null default false,
  return_day integer check (return_day is null or return_day >= 0),
  ordinal integer not null check (ordinal >= 0),
  unique (template_id, item_key)
);

create table public.skin_passes (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  template_id uuid references public.treatment_protocol_templates(id) on delete set null,
  client_name text not null,
  client_mobile text,
  treatment_key text not null,
  treatment_name text not null,
  treatment_date date not null,
  status public.skin_pass_status not null default 'draft',
  provider_guidance text not null default 'Use only the products and activities named in this Skin Pass. Contact the provider for symptoms or anything unexpected.',
  protocol_version integer not null default 1 check (protocol_version > 0),
  issued_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint issued_has_timestamp check (status <> 'issued' or issued_at is not null),
  constraint revoked_has_timestamp check (status <> 'revoked' or revoked_at is not null)
);

create table public.skin_pass_items (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.skin_passes(id) on delete cascade,
  item_key text not null,
  item_label text not null,
  kind public.pass_item_kind not null,
  inventory_group public.pass_inventory_group not null,
  baseline_available boolean not null default false,
  authored_return_at timestamptz,
  provider_note text,
  ordinal integer not null check (ordinal >= 0),
  created_at timestamptz not null default clock_timestamp(),
  unique (pass_id, item_key)
);

create table public.return_events (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.skin_passes(id) on delete cascade,
  pass_item_id uuid not null references public.skin_pass_items(id) on delete restrict,
  ordinal integer not null check (ordinal > 0),
  return_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (pass_id, ordinal),
  unique (pass_id, pass_item_id)
);

create table public.protocol_versions (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.skin_passes(id) on delete cascade,
  version integer not null check (version > 0),
  authored_by uuid not null references public.provider_profiles(id) on delete restrict,
  reason text,
  changed_item_label text,
  previous_return_at timestamptz,
  new_return_at timestamptz,
  snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (pass_id, version)
);

create table public.pass_access_tokens (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.skin_passes(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz,
  last_verified_ip_fingerprint text
);

create table public.pass_audit_events (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.skin_passes(id) on delete cascade,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  action public.pass_audit_action not null,
  actor_kind text not null check (actor_kind in ('provider', 'client', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create table private.pass_access_attempts (
  id bigint generated always as identity primary key,
  ip_fingerprint text not null,
  public_id text not null,
  attempted_at timestamptz not null default clock_timestamp()
);
create index pass_access_attempts_window_idx on private.pass_access_attempts (ip_fingerprint, attempted_at desc);

create index skin_passes_provider_idx on public.skin_passes(provider_id, created_at desc);
create index return_events_pass_return_idx on public.return_events(pass_id, return_at);
create index audit_events_pass_created_idx on public.pass_audit_events(pass_id, created_at desc);
create index pass_tokens_pass_idx on public.pass_access_tokens(pass_id);

create or replace function private.make_public_pass_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'SP-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger provider_profiles_touch before update on public.provider_profiles
for each row execute function private.touch_updated_at();
create trigger templates_touch before update on public.treatment_protocol_templates
for each row execute function private.touch_updated_at();
create trigger skin_passes_touch before update on public.skin_passes
for each row execute function private.touch_updated_at();
create trigger return_events_touch before update on public.return_events
for each row execute function private.touch_updated_at();

create or replace function private.prevent_completed_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is not null and (
    tg_op = 'DELETE' or
    new.return_at is distinct from old.return_at or
    new.pass_item_id is distinct from old.pass_item_id or
    new.ordinal is distinct from old.ordinal or
    new.completed_at is distinct from old.completed_at
  ) then
    raise exception 'completed return events are immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger immutable_completed_event_update
before update on public.return_events
for each row execute function private.prevent_completed_event_mutation();
create trigger immutable_completed_event_delete
before delete on public.return_events
for each row execute function private.prevent_completed_event_mutation();

create or replace function private.handle_new_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.provider_profiles (id, display_name, studio_name, mobile)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Provider'), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'studio_name', ''), 'RE:ENTRY Provider'),
    nullif(new.raw_user_meta_data ->> 'mobile', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_provider() from public, anon, authenticated;

create trigger on_auth_provider_created
after insert on auth.users
for each row execute function private.handle_new_provider();

alter table public.provider_profiles enable row level security;
alter table public.treatment_protocol_templates enable row level security;
alter table public.treatment_protocol_template_items enable row level security;
alter table public.skin_passes enable row level security;
alter table public.skin_pass_items enable row level security;
alter table public.return_events enable row level security;
alter table public.protocol_versions enable row level security;
alter table public.pass_access_tokens enable row level security;
alter table public.pass_audit_events enable row level security;

create policy provider_profile_owner_select on public.provider_profiles for select to authenticated
using ((select auth.uid()) = id);
create policy provider_profile_owner_update on public.provider_profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy template_read on public.treatment_protocol_templates for select to authenticated
using (is_system or provider_id = (select auth.uid()));
create policy template_owner_insert on public.treatment_protocol_templates for insert to authenticated
with check (provider_id = (select auth.uid()));
create policy template_owner_update on public.treatment_protocol_templates for update to authenticated
using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));
create policy template_owner_delete on public.treatment_protocol_templates for delete to authenticated
using (provider_id = (select auth.uid()));

create policy template_items_read on public.treatment_protocol_template_items for select to authenticated
using (exists (
  select 1 from public.treatment_protocol_templates t
  where t.id = template_id and (t.is_system or t.provider_id = (select auth.uid()))
));
create policy template_items_owner_write on public.treatment_protocol_template_items for all to authenticated
using (exists (
  select 1 from public.treatment_protocol_templates t
  where t.id = template_id and t.provider_id = (select auth.uid())
))
with check (exists (
  select 1 from public.treatment_protocol_templates t
  where t.id = template_id and t.provider_id = (select auth.uid())
));

create policy pass_owner_all on public.skin_passes for all to authenticated
using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));

create policy pass_items_owner_all on public.skin_pass_items for all to authenticated
using (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())))
with check (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())));

create policy return_events_owner_all on public.return_events for all to authenticated
using (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())))
with check (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())));

create policy protocol_versions_owner_all on public.protocol_versions for all to authenticated
using (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())))
with check (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())));

create policy access_tokens_owner_select on public.pass_access_tokens for select to authenticated
using (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())));
create policy access_tokens_owner_insert on public.pass_access_tokens for insert to authenticated
with check (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())));
create policy access_tokens_owner_update on public.pass_access_tokens for update to authenticated
using (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())))
with check (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())));

create policy audit_owner_read on public.pass_audit_events for select to authenticated
using (exists (select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())));
create policy audit_owner_insert on public.pass_audit_events for insert to authenticated
with check (provider_id = (select auth.uid()) and exists (
  select 1 from public.skin_passes p where p.id = pass_id and p.provider_id = (select auth.uid())
));

revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.provider_profiles to authenticated;
grant select, insert, update, delete on public.treatment_protocol_templates to authenticated;
grant select, insert, update, delete on public.treatment_protocol_template_items to authenticated;
grant select, insert, update, delete on public.skin_passes to authenticated;
grant select, insert, update, delete on public.skin_pass_items to authenticated;
grant select, insert, update, delete on public.return_events to authenticated;
grant select, insert, update, delete on public.protocol_versions to authenticated;
grant select, insert, update on public.pass_access_tokens to authenticated;
grant select, insert on public.pass_audit_events to authenticated;
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.make_public_pass_id() to authenticated;

insert into public.treatment_protocol_templates (
  provider_id, treatment_key, treatment_name, description, is_system
) values (
  null, 'microneedling', 'Microneedling', 'Provider-authored staged re-entry baseline.', true
) on conflict (provider_id, treatment_key) do update set treatment_name = excluded.treatment_name;

insert into public.treatment_protocol_template_items (
  template_id, item_key, item_label, kind, inventory_group, baseline_available, return_day, ordinal
)
select t.id, x.item_key, x.item_label, x.kind, x.inventory_group, x.baseline_available, x.return_day, x.ordinal
from public.treatment_protocol_templates t
cross join (values
  ('gentle-cleanser', 'Gentle cleanser', 'product'::public.pass_item_kind, 'routine'::public.pass_inventory_group, true, null::integer, 0),
  ('barrier-moisturizer', 'Barrier moisturizer', 'product'::public.pass_item_kind, 'routine'::public.pass_inventory_group, true, null::integer, 1),
  ('mineral-spf', 'Mineral SPF', 'product'::public.pass_item_kind, 'routine'::public.pass_inventory_group, true, null::integer, 2),
  ('intense-exercise', 'Intense exercise', 'activity'::public.pass_item_kind, 'activity'::public.pass_inventory_group, true, 0, 3),
  ('makeup', 'Makeup', 'product'::public.pass_item_kind, 'routine'::public.pass_inventory_group, false, 3, 4),
  ('exfoliating-acids', 'Exfoliating acids', 'product'::public.pass_item_kind, 'routine'::public.pass_inventory_group, false, 5, 5),
  ('retinoid', 'Retinoid', 'product'::public.pass_item_kind, 'routine'::public.pass_inventory_group, false, 7, 6)
) as x(item_key, item_label, kind, inventory_group, baseline_available, return_day, ordinal)
where t.provider_id is null and t.treatment_key = 'microneedling'
on conflict (template_id, item_key) do update set
  item_label = excluded.item_label,
  kind = excluded.kind,
  inventory_group = excluded.inventory_group,
  baseline_available = excluded.baseline_available,
  return_day = excluded.return_day,
  ordinal = excluded.ordinal;

create or replace function private.protocol_timestamp(
  p_treatment_date date,
  p_return_day integer,
  p_timezone text default 'America/Los_Angeles'
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((p_treatment_date + p_return_day)::timestamp at time zone p_timezone);
$$;

create or replace function public.issue_skin_pass(
  p_client_name text,
  p_client_mobile text,
  p_treatment_date date,
  p_makeup_day integer default 3,
  p_acids_day integer default 5,
  p_retinoid_day integer default 7,
  p_exercise_day integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider uuid := (select auth.uid());
  v_template uuid;
  v_pass uuid := gen_random_uuid();
  v_public_id text;
  v_raw_token text;
  v_item uuid;
  v_snapshot jsonb;
begin
  if v_provider is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if trim(coalesce(p_client_name, '')) = '' then raise exception 'client name is required' using errcode = '22023'; end if;
  if p_makeup_day < 0 or p_acids_day < 0 or p_retinoid_day < 0 or p_exercise_day < 0 then
    raise exception 'return days must be non-negative' using errcode = '22023';
  end if;

  select id into v_template from public.treatment_protocol_templates
  where provider_id is null and treatment_key = 'microneedling' limit 1;

  loop
    v_public_id := private.make_public_pass_id();
    exit when not exists (select 1 from public.skin_passes where public_id = v_public_id);
  end loop;
  v_raw_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.skin_passes (
    id, public_id, provider_id, template_id, client_name, client_mobile,
    treatment_key, treatment_name, treatment_date, status, issued_at
  ) values (
    v_pass, v_public_id, v_provider, v_template, trim(p_client_name), nullif(trim(coalesce(p_client_mobile, '')), ''),
    'microneedling', 'Microneedling', p_treatment_date, 'issued', clock_timestamp()
  );

  insert into public.skin_pass_items (pass_id, item_key, item_label, kind, inventory_group, baseline_available, authored_return_at, ordinal)
  values
    (v_pass, 'gentle-cleanser', 'Gentle cleanser', 'product', 'routine', true, null, 0),
    (v_pass, 'barrier-moisturizer', 'Barrier moisturizer', 'product', 'routine', true, null, 1),
    (v_pass, 'mineral-spf', 'Mineral SPF', 'product', 'routine', true, null, 2),
    (v_pass, 'intense-exercise', 'Intense exercise', 'activity', 'activity', true, private.protocol_timestamp(p_treatment_date, p_exercise_day, 'America/Los_Angeles'), 3),
    (v_pass, 'makeup', 'Makeup', 'product', 'routine', false, private.protocol_timestamp(p_treatment_date, p_makeup_day, 'America/Los_Angeles'), 4),
    (v_pass, 'exfoliating-acids', 'Exfoliating acids', 'product', 'routine', false, private.protocol_timestamp(p_treatment_date, p_acids_day, 'America/Los_Angeles'), 5),
    (v_pass, 'retinoid', 'Retinoid', 'product', 'routine', false, private.protocol_timestamp(p_treatment_date, p_retinoid_day, 'America/Los_Angeles'), 6);

  for v_item in select id from public.skin_pass_items where pass_id = v_pass and item_key = 'makeup' loop
    insert into public.return_events (pass_id, pass_item_id, ordinal, return_at)
    values (v_pass, v_item, 1, private.protocol_timestamp(p_treatment_date, p_makeup_day, 'America/Los_Angeles'));
  end loop;
  for v_item in select id from public.skin_pass_items where pass_id = v_pass and item_key = 'exfoliating-acids' loop
    insert into public.return_events (pass_id, pass_item_id, ordinal, return_at)
    values (v_pass, v_item, 2, private.protocol_timestamp(p_treatment_date, p_acids_day, 'America/Los_Angeles'));
  end loop;
  for v_item in select id from public.skin_pass_items where pass_id = v_pass and item_key = 'retinoid' loop
    insert into public.return_events (pass_id, pass_item_id, ordinal, return_at)
    values (v_pass, v_item, 3, private.protocol_timestamp(p_treatment_date, p_retinoid_day, 'America/Los_Angeles'));
  end loop;

  select jsonb_build_object(
    'treatment', 'Microneedling',
    'treatmentDate', p_treatment_date,
    'items', jsonb_agg(jsonb_build_object('key', item_key, 'label', item_label, 'returnAt', authored_return_at) order by ordinal)
  ) into v_snapshot from public.skin_pass_items where pass_id = v_pass;

  insert into public.protocol_versions (pass_id, version, authored_by, reason, snapshot)
  values (v_pass, 1, v_provider, 'Issued', v_snapshot);
  insert into public.pass_access_tokens (pass_id, token_hash)
  values (v_pass, extensions.digest(v_raw_token, 'sha256'));
  insert into public.pass_audit_events (pass_id, provider_id, action, actor_kind, metadata)
  values (v_pass, v_provider, 'pass_issued', 'provider', jsonb_build_object('publicId', v_public_id));

  return jsonb_build_object('id', v_pass, 'publicId', v_public_id, 'token', v_raw_token, 'protocolVersion', 1);
end;
$$;
revoke all on function public.issue_skin_pass(text,text,date,integer,integer,integer,integer) from public, anon;
grant execute on function public.issue_skin_pass(text,text,date,integer,integer,integer,integer) to authenticated;

create or replace function public.publish_protocol_update(
  p_pass_id uuid,
  p_event_id uuid,
  p_new_return_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider uuid := (select auth.uid());
  v_event public.return_events%rowtype;
  v_pass public.skin_passes%rowtype;
  v_item_label text;
  v_next_version integer;
  v_snapshot jsonb;
begin
  select * into v_pass from public.skin_passes where id = p_pass_id and provider_id = v_provider for update;
  if not found then raise exception 'pass not found' using errcode = '42501'; end if;
  if v_pass.status <> 'issued' then raise exception 'only active issued passes can be updated' using errcode = '23514'; end if;

  select * into v_event from public.return_events where id = p_event_id and pass_id = p_pass_id for update;
  if not found then raise exception 'event not found' using errcode = '22023'; end if;
  if v_event.completed_at is not null or v_event.return_at <= clock_timestamp() then
    raise exception 'only future events may be edited' using errcode = '23514';
  end if;
  if p_new_return_at <= clock_timestamp() then raise exception 'new return date must remain in the future' using errcode = '23514'; end if;

  select item_label into v_item_label from public.skin_pass_items where id = v_event.pass_item_id;
  update public.return_events set return_at = p_new_return_at where id = p_event_id;
  update public.skin_pass_items set authored_return_at = p_new_return_at where id = v_event.pass_item_id;
  v_next_version := v_pass.protocol_version + 1;
  update public.skin_passes set protocol_version = v_next_version where id = p_pass_id;

  select jsonb_build_object(
    'treatment', v_pass.treatment_name,
    'treatmentDate', v_pass.treatment_date,
    'items', jsonb_agg(jsonb_build_object('key', i.item_key, 'label', i.item_label, 'returnAt', i.authored_return_at) order by i.ordinal)
  ) into v_snapshot from public.skin_pass_items i where i.pass_id = p_pass_id;

  insert into public.protocol_versions (
    pass_id, version, authored_by, reason, changed_item_label, previous_return_at, new_return_at, snapshot
  ) values (
    p_pass_id, v_next_version, v_provider, nullif(trim(coalesce(p_reason, '')), ''), v_item_label,
    v_event.return_at, p_new_return_at, v_snapshot
  );
  insert into public.pass_audit_events (pass_id, provider_id, action, actor_kind, metadata)
  values (p_pass_id, v_provider, 'protocol_updated', 'provider', jsonb_build_object(
    'item', v_item_label, 'previousReturnAt', v_event.return_at, 'newReturnAt', p_new_return_at, 'version', v_next_version
  ));
  return jsonb_build_object('version', v_next_version, 'itemLabel', v_item_label, 'previousReturnAt', v_event.return_at, 'newReturnAt', p_new_return_at);
end;
$$;
revoke all on function public.publish_protocol_update(uuid,uuid,timestamptz,text) from public, anon;
grant execute on function public.publish_protocol_update(uuid,uuid,timestamptz,text) to authenticated;

create or replace function public.revoke_skin_pass(p_pass_id uuid, p_reason text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider uuid := (select auth.uid());
  v_public_id text;
begin
  update public.skin_passes
  set status = 'revoked', revoked_at = clock_timestamp(), revoked_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_pass_id and provider_id = v_provider and status <> 'revoked'
  returning public_id into v_public_id;
  if v_public_id is null then raise exception 'pass not found or already revoked' using errcode = '42501'; end if;
  update public.pass_access_tokens set revoked_at = clock_timestamp() where pass_id = p_pass_id and revoked_at is null;
  insert into public.pass_audit_events (pass_id, provider_id, action, actor_kind, metadata)
  values (p_pass_id, v_provider, 'pass_revoked', 'provider', jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return jsonb_build_object('publicId', v_public_id, 'revoked', true);
end;
$$;
revoke all on function public.revoke_skin_pass(uuid,text) from public, anon;
grant execute on function public.revoke_skin_pass(uuid,text) to authenticated;

create or replace function public.lookup_skin_pass(
  p_public_id text,
  p_token text,
  p_ip_fingerprint text default 'unknown'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_pass public.skin_passes%rowtype;
  v_token public.pass_access_tokens%rowtype;
  v_provider public.provider_profiles%rowtype;
  v_attempts integer;
  v_items jsonb;
  v_events jsonb;
  v_versions jsonb;
begin
  delete from private.pass_access_attempts where attempted_at < v_now - interval '1 day';
  select count(*) into v_attempts from private.pass_access_attempts
  where ip_fingerprint = left(coalesce(p_ip_fingerprint, 'unknown'), 128)
    and attempted_at > v_now - interval '10 minutes';
  if v_attempts >= 30 then
    return jsonb_build_object('access', 'invalid', 'serverNow', v_now, 'lastVerifiedAt', v_now, 'rateLimited', true);
  end if;
  insert into private.pass_access_attempts(ip_fingerprint, public_id)
  values (left(coalesce(p_ip_fingerprint, 'unknown'), 128), left(coalesce(p_public_id, ''), 64));

  select pat.* into v_token
  from public.pass_access_tokens pat
  join public.skin_passes sp on sp.id = pat.pass_id
  where sp.public_id = p_public_id
    and pat.token_hash = extensions.digest(p_token, 'sha256')
  order by pat.created_at desc limit 1;

  if not found then
    return jsonb_build_object('access', 'invalid', 'serverNow', v_now, 'lastVerifiedAt', v_now);
  end if;
  select * into v_pass from public.skin_passes where id = v_token.pass_id;

  if v_pass.status = 'revoked' or v_token.revoked_at is not null then
    return jsonb_build_object('access', 'revoked', 'serverNow', v_now, 'lastVerifiedAt', coalesce(v_token.last_verified_at, v_now), 'publicId', v_pass.public_id);
  end if;
  if v_pass.status = 'expired' or (v_pass.expires_at is not null and v_pass.expires_at <= v_now)
     or (v_token.expires_at is not null and v_token.expires_at <= v_now) then
    return jsonb_build_object('access', 'expired', 'serverNow', v_now, 'lastVerifiedAt', coalesce(v_token.last_verified_at, v_now), 'publicId', v_pass.public_id);
  end if;
  if v_pass.status <> 'issued' then
    return jsonb_build_object('access', 'invalid', 'serverNow', v_now, 'lastVerifiedAt', v_now);
  end if;

  update public.return_events
  set completed_at = return_at
  where pass_id = v_pass.id and completed_at is null and return_at <= v_now;
  update public.pass_access_tokens
  set last_verified_at = v_now, last_verified_ip_fingerprint = left(coalesce(p_ip_fingerprint, 'unknown'), 128)
  where id = v_token.id;
  select * into v_provider from public.provider_profiles where id = v_pass.provider_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'key', i.item_key, 'label', i.item_label, 'kind', i.kind,
    'inventoryGroup', i.inventory_group, 'baselineAvailable', i.baseline_available,
    'authoredReturnAt', i.authored_return_at, 'providerNote', i.provider_note
  ) order by i.ordinal), '[]'::jsonb) into v_items
  from public.skin_pass_items i where i.pass_id = v_pass.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'itemId', e.pass_item_id, 'itemKey', i.item_key, 'itemLabel', i.item_label,
    'ordinal', e.ordinal, 'returnAt', e.return_at, 'completedAt', e.completed_at
  ) order by e.return_at, e.ordinal), '[]'::jsonb) into v_events
  from public.return_events e join public.skin_pass_items i on i.id = e.pass_item_id
  where e.pass_id = v_pass.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'version', pv.version, 'createdAt', pv.created_at, 'reason', pv.reason,
    'changedItemLabel', pv.changed_item_label, 'previousReturnAt', pv.previous_return_at,
    'newReturnAt', pv.new_return_at
  ) order by pv.version), '[]'::jsonb) into v_versions
  from public.protocol_versions pv where pv.pass_id = v_pass.id;

  insert into public.pass_audit_events(pass_id, provider_id, action, actor_kind, metadata)
  values (v_pass.id, null, 'pass_opened', 'client', jsonb_build_object('protocolVersion', v_pass.protocol_version));

  return jsonb_build_object(
    'access', 'active', 'serverNow', v_now, 'lastVerifiedAt', v_now,
    'publicId', v_pass.public_id, 'clientName', v_pass.client_name,
    'treatmentName', v_pass.treatment_name, 'treatmentDate', v_pass.treatment_date,
    'providerName', v_provider.studio_name, 'providerPhone', v_provider.mobile,
    'providerGuidance', v_pass.provider_guidance, 'protocolVersion', v_pass.protocol_version,
    'status', v_pass.status, 'items', v_items, 'events', v_events, 'versions', v_versions
  );
end;
$$;
revoke all on function public.lookup_skin_pass(text,text,text) from public;
grant execute on function public.lookup_skin_pass(text,text,text) to anon, authenticated;

comment on function public.lookup_skin_pass(text,text,text) is
'Public token boundary. Returns protocol data only after hash verification, rate limiting, and lifecycle checks. Revoked access returns no protocol details.';
