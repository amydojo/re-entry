do $$
begin
  create type public.protocol_template_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.protocol_templates (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  protocol_name text not null default '',
  treatment_label text not null default '',
  internal_description text not null default '',
  status public.protocol_template_status not null default 'draft',
  recovery_duration_days integer not null default 7 check (recovery_duration_days between 1 and 180),
  protocol_timezone text not null default 'America/Los_Angeles',
  provider_guidance text not null default '',
  routine_restored_message text not null default 'Your provider-authored routine is fully restored.',
  current_published_version integer not null default 0 check (current_published_version >= 0),
  has_unpublished_changes boolean not null default false,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.protocol_draft_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.protocol_templates(id) on delete cascade,
  item_key text not null,
  canonical_name text not null default '',
  kind public.pass_item_kind not null default 'product',
  category text not null default '',
  inventory_group public.pass_inventory_group not null default 'routine',
  client_explanation text not null default '',
  provider_note text not null default '',
  baseline_available boolean not null default false,
  return_day integer check (return_day is null or return_day between 0 and 180),
  aliases text[] not null default '{}',
  ordinal integer not null check (ordinal between 0 and 200),
  enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (template_id, item_key)
);

create table if not exists public.protocol_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.protocol_templates(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  change_summary text not null default '',
  item_count integer not null check (item_count > 0),
  published_at timestamptz not null default clock_timestamp(),
  unique (template_id, version)
);

create table if not exists public.protocol_template_version_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.protocol_template_versions(id) on delete restrict,
  item_key text not null,
  canonical_name text not null,
  kind public.pass_item_kind not null,
  category text not null default '',
  inventory_group public.pass_inventory_group not null,
  client_explanation text not null default '',
  provider_note text not null default '',
  baseline_available boolean not null default false,
  return_day integer check (return_day is null or return_day between 0 and 180),
  ordinal integer not null check (ordinal between 0 and 200),
  unique (version_id, item_key),
  unique (version_id, ordinal)
);

create table if not exists public.protocol_template_version_aliases (
  id uuid primary key default gen_random_uuid(),
  version_item_id uuid not null references public.protocol_template_version_items(id) on delete restrict,
  alias text not null,
  normalized_alias text not null,
  unique (version_item_id, normalized_alias)
);

create table if not exists public.protocol_template_version_events (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.protocol_template_versions(id) on delete restrict,
  version_item_id uuid not null references public.protocol_template_version_items(id) on delete restrict,
  return_day integer not null check (return_day between 0 and 180),
  ordinal integer not null check (ordinal > 0),
  unique (version_id, version_item_id),
  unique (version_id, ordinal)
);

alter table public.skin_passes
  add column if not exists template_version_id uuid references public.protocol_template_versions(id) on delete set null,
  add column if not exists issued_snapshot jsonb,
  add column if not exists recovery_duration_days integer not null default 7 check (recovery_duration_days between 1 and 180),
  add column if not exists routine_restored_message text not null default 'Your provider-authored routine is fully restored.';

alter table public.skin_pass_items
  add column if not exists client_explanation text;

create table if not exists public.skin_pass_item_aliases (
  id uuid primary key default gen_random_uuid(),
  pass_item_id uuid not null references public.skin_pass_items(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  unique (pass_item_id, normalized_alias)
);

create index if not exists protocol_templates_provider_status_idx on public.protocol_templates(provider_id, status, updated_at desc);
create index if not exists protocol_draft_items_template_idx on public.protocol_draft_items(template_id, ordinal);
create index if not exists protocol_versions_template_idx on public.protocol_template_versions(template_id, version desc);
create index if not exists protocol_version_items_version_idx on public.protocol_template_version_items(version_id, ordinal);
create index if not exists protocol_version_alias_lookup_idx on public.protocol_template_version_aliases(normalized_alias);
create index if not exists protocol_version_events_version_idx on public.protocol_template_version_events(version_id, return_day, ordinal);
create index if not exists skin_pass_alias_lookup_idx on public.skin_pass_item_aliases(normalized_alias);
create index if not exists skin_passes_template_version_idx on public.skin_passes(template_version_id);

create or replace function private.normalize_protocol_term(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function private.prevent_protocol_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'published protocol versions are immutable' using errcode = '23514';
end;
$$;

drop trigger if exists immutable_protocol_template_versions on public.protocol_template_versions;
create trigger immutable_protocol_template_versions before update or delete on public.protocol_template_versions
for each row execute function private.prevent_protocol_version_mutation();
drop trigger if exists immutable_protocol_template_version_items on public.protocol_template_version_items;
create trigger immutable_protocol_template_version_items before update or delete on public.protocol_template_version_items
for each row execute function private.prevent_protocol_version_mutation();
drop trigger if exists immutable_protocol_template_version_aliases on public.protocol_template_version_aliases;
create trigger immutable_protocol_template_version_aliases before update or delete on public.protocol_template_version_aliases
for each row execute function private.prevent_protocol_version_mutation();
drop trigger if exists immutable_protocol_template_version_events on public.protocol_template_version_events;
create trigger immutable_protocol_template_version_events before update or delete on public.protocol_template_version_events
for each row execute function private.prevent_protocol_version_mutation();

drop trigger if exists protocol_templates_touch on public.protocol_templates;
create trigger protocol_templates_touch before update on public.protocol_templates
for each row execute function private.touch_updated_at();
drop trigger if exists protocol_draft_items_touch on public.protocol_draft_items;
create trigger protocol_draft_items_touch before update on public.protocol_draft_items
for each row execute function private.touch_updated_at();

alter table public.protocol_templates enable row level security;
alter table public.protocol_draft_items enable row level security;
alter table public.protocol_template_versions enable row level security;
alter table public.protocol_template_version_items enable row level security;
alter table public.protocol_template_version_aliases enable row level security;
alter table public.protocol_template_version_events enable row level security;
alter table public.skin_pass_item_aliases enable row level security;

drop policy if exists protocol_templates_owner_select on public.protocol_templates;
create policy protocol_templates_owner_select on public.protocol_templates for select to authenticated
using (provider_id = (select auth.uid()));
drop policy if exists protocol_templates_owner_insert on public.protocol_templates;
create policy protocol_templates_owner_insert on public.protocol_templates for insert to authenticated
with check (provider_id = (select auth.uid()));
drop policy if exists protocol_templates_owner_update on public.protocol_templates;
create policy protocol_templates_owner_update on public.protocol_templates for update to authenticated
using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));

drop policy if exists protocol_draft_items_owner_select on public.protocol_draft_items;
create policy protocol_draft_items_owner_select on public.protocol_draft_items for select to authenticated
using (exists (
  select 1 from public.protocol_templates t
  where t.id = template_id and t.provider_id = (select auth.uid())
));

drop policy if exists protocol_versions_owner_select on public.protocol_template_versions;
create policy protocol_versions_owner_select on public.protocol_template_versions for select to authenticated
using (provider_id = (select auth.uid()));

drop policy if exists protocol_version_items_owner_select on public.protocol_template_version_items;
create policy protocol_version_items_owner_select on public.protocol_template_version_items for select to authenticated
using (exists (
  select 1 from public.protocol_template_versions v
  where v.id = version_id and v.provider_id = (select auth.uid())
));

drop policy if exists protocol_version_aliases_owner_select on public.protocol_template_version_aliases;
create policy protocol_version_aliases_owner_select on public.protocol_template_version_aliases for select to authenticated
using (exists (
  select 1 from public.protocol_template_version_items i
  join public.protocol_template_versions v on v.id = i.version_id
  where i.id = version_item_id and v.provider_id = (select auth.uid())
));

drop policy if exists protocol_version_events_owner_select on public.protocol_template_version_events;
create policy protocol_version_events_owner_select on public.protocol_template_version_events for select to authenticated
using (exists (
  select 1 from public.protocol_template_versions v
  where v.id = version_id and v.provider_id = (select auth.uid())
));

drop policy if exists skin_pass_aliases_owner_select on public.skin_pass_item_aliases;
create policy skin_pass_aliases_owner_select on public.skin_pass_item_aliases for select to authenticated
using (exists (
  select 1 from public.skin_pass_items i
  join public.skin_passes p on p.id = i.pass_id
  where i.id = pass_item_id and p.provider_id = (select auth.uid())
));

grant select on public.protocol_templates, public.protocol_draft_items, public.protocol_template_versions,
  public.protocol_template_version_items, public.protocol_template_version_aliases,
  public.protocol_template_version_events, public.skin_pass_item_aliases to authenticated;
revoke all on public.protocol_templates, public.protocol_draft_items, public.protocol_template_versions,
  public.protocol_template_version_items, public.protocol_template_version_aliases,
  public.protocol_template_version_events, public.skin_pass_item_aliases from anon;

create or replace function public.save_protocol_draft(p_template_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid := (select auth.uid());
  v_template public.protocol_templates%rowtype;
  v_item jsonb;
  v_item_key text;
  v_status public.protocol_template_status;
begin
  if v_provider is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'protocol payload is required' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = coalesce(nullif(p_payload ->> 'protocolTimeZone', ''), 'America/Los_Angeles')) then
    raise exception 'invalid protocol timezone' using errcode = '22023';
  end if;

  if p_template_id is null then
    insert into public.protocol_templates (
      provider_id, protocol_name, treatment_label, internal_description, status,
      recovery_duration_days, protocol_timezone, provider_guidance, routine_restored_message
    ) values (
      v_provider,
      trim(coalesce(p_payload ->> 'protocolName', '')),
      trim(coalesce(p_payload ->> 'treatmentLabel', '')),
      trim(coalesce(p_payload ->> 'internalDescription', '')),
      'draft',
      coalesce(nullif(p_payload ->> 'recoveryDurationDays', '')::integer, 7),
      coalesce(nullif(p_payload ->> 'protocolTimeZone', ''), 'America/Los_Angeles'),
      trim(coalesce(p_payload ->> 'providerGuidance', '')),
      coalesce(nullif(trim(coalesce(p_payload ->> 'routineRestoredMessage', '')), ''), 'Your provider-authored routine is fully restored.')
    ) returning * into v_template;
  else
    select * into v_template from public.protocol_templates
    where id = p_template_id and provider_id = v_provider for update;
    if not found then raise exception 'protocol not found' using errcode = '42501'; end if;
    if v_template.status = 'archived' then raise exception 'archived protocols cannot be edited' using errcode = '23514'; end if;
    v_status := case when v_template.current_published_version > 0 then 'published'::public.protocol_template_status else 'draft'::public.protocol_template_status end;
    update public.protocol_templates set
      protocol_name = trim(coalesce(p_payload ->> 'protocolName', '')),
      treatment_label = trim(coalesce(p_payload ->> 'treatmentLabel', '')),
      internal_description = trim(coalesce(p_payload ->> 'internalDescription', '')),
      status = v_status,
      recovery_duration_days = coalesce(nullif(p_payload ->> 'recoveryDurationDays', '')::integer, 7),
      protocol_timezone = coalesce(nullif(p_payload ->> 'protocolTimeZone', ''), 'America/Los_Angeles'),
      provider_guidance = trim(coalesce(p_payload ->> 'providerGuidance', '')),
      routine_restored_message = coalesce(nullif(trim(coalesce(p_payload ->> 'routineRestoredMessage', '')), ''), 'Your provider-authored routine is fully restored.'),
      has_unpublished_changes = current_published_version > 0
    where id = v_template.id
    returning * into v_template;
    delete from public.protocol_draft_items where template_id = v_template.id;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) loop
    v_item_key := trim(coalesce(v_item ->> 'itemKey', ''));
    if v_item_key = '' then
      v_item_key := replace(private.normalize_protocol_term(v_item ->> 'canonicalName'), ' ', '-');
    end if;
    if v_item_key = '' then v_item_key := 'item-' || coalesce(v_item ->> 'ordinal', '0'); end if;
    insert into public.protocol_draft_items (
      template_id, item_key, canonical_name, kind, category, inventory_group,
      client_explanation, provider_note, baseline_available, return_day, aliases, ordinal, enabled
    ) values (
      v_template.id,
      v_item_key,
      trim(coalesce(v_item ->> 'canonicalName', '')),
      coalesce(nullif(v_item ->> 'kind', '')::public.pass_item_kind, 'product'),
      trim(coalesce(v_item ->> 'category', '')),
      coalesce(nullif(v_item ->> 'inventoryGroup', '')::public.pass_inventory_group, 'routine'),
      trim(coalesce(v_item ->> 'clientExplanation', '')),
      trim(coalesce(v_item ->> 'providerNote', '')),
      coalesce((v_item ->> 'baselineAvailable')::boolean, false),
      case when v_item -> 'returnDay' is null or jsonb_typeof(v_item -> 'returnDay') = 'null' then null else (v_item ->> 'returnDay')::integer end,
      array(select trim(value) from jsonb_array_elements_text(coalesce(v_item -> 'aliases', '[]'::jsonb)) where trim(value) <> ''),
      coalesce((v_item ->> 'ordinal')::integer, 0),
      coalesce((v_item ->> 'enabled')::boolean, true)
    );
  end loop;

  return jsonb_build_object('id', v_template.id, 'status', v_template.status, 'currentPublishedVersion', v_template.current_published_version);
end;
$$;

create or replace function public.publish_protocol_template(p_template_id uuid, p_change_summary text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid := (select auth.uid());
  v_template public.protocol_templates%rowtype;
  v_version_id uuid := gen_random_uuid();
  v_next_version integer;
  v_item_count integer;
  v_bad text;
  v_snapshot jsonb;
begin
  if v_provider is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v_template from public.protocol_templates
  where id = p_template_id and provider_id = v_provider for update;
  if not found then raise exception 'protocol not found' using errcode = '42501'; end if;
  if v_template.status = 'archived' then raise exception 'archived protocols cannot be published' using errcode = '23514'; end if;
  if trim(v_template.protocol_name) = '' or trim(v_template.treatment_label) = '' then
    raise exception 'protocol identity is required' using errcode = '22023';
  end if;
  if trim(v_template.provider_guidance) = '' or trim(v_template.routine_restored_message) = '' then
    raise exception 'client guidance is required' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_template.protocol_timezone) then
    raise exception 'invalid protocol timezone' using errcode = '22023';
  end if;

  select count(*) into v_item_count from public.protocol_draft_items where template_id = p_template_id and enabled;
  if v_item_count = 0 then raise exception 'published protocols need at least one enabled item' using errcode = '22023'; end if;

  if exists (
    select 1 from public.protocol_draft_items
    where template_id = p_template_id and enabled
      and (trim(canonical_name) = '' or trim(item_key) = '')
  ) then raise exception 'all enabled items need a canonical name and item key' using errcode = '22023'; end if;

  if exists (
    select 1 from public.protocol_draft_items
    where template_id = p_template_id and enabled
      and ((baseline_available and coalesce(return_day, 0) > 0)
        or (not baseline_available and return_day is null)
        or (return_day is not null and return_day > v_template.recovery_duration_days))
  ) then raise exception 'item timing conflicts with availability or recovery duration' using errcode = '22023'; end if;

  if exists (
    select 1 from (
      select ordinal, count(*) from public.protocol_draft_items
      where template_id = p_template_id and enabled group by ordinal having count(*) > 1
    ) duplicate_order
  ) or (select min(ordinal) from public.protocol_draft_items where template_id = p_template_id and enabled) <> 0
     or (select max(ordinal) from public.protocol_draft_items where template_id = p_template_id and enabled) <> v_item_count - 1 then
    raise exception 'enabled item display order must be unique and contiguous from zero' using errcode = '22023';
  end if;

  select private.normalize_protocol_term(canonical_name) into v_bad
  from public.protocol_draft_items
  where template_id = p_template_id and enabled
  group by private.normalize_protocol_term(canonical_name)
  having count(*) > 1 limit 1;
  if v_bad is not null then raise exception 'duplicate canonical item name: %', v_bad using errcode = '22023'; end if;

  if exists (
    select 1 from public.protocol_draft_items d,
    lateral unnest(d.aliases) alias
    where d.template_id = p_template_id and d.enabled and private.normalize_protocol_term(alias) = ''
  ) then raise exception 'empty aliases are not allowed' using errcode = '22023'; end if;

  if exists (
    select 1 from (
      select d.id, private.normalize_protocol_term(alias) normalized
      from public.protocol_draft_items d, lateral unnest(d.aliases) alias
      where d.template_id = p_template_id and d.enabled
      group by d.id, private.normalize_protocol_term(alias)
      having count(*) > 1
    ) duplicate_alias
  ) then raise exception 'an item contains duplicate aliases' using errcode = '22023'; end if;

  if exists (
    with terms as (
      select id item_id, private.normalize_protocol_term(canonical_name) normalized
      from public.protocol_draft_items where template_id = p_template_id and enabled
      union all
      select d.id, private.normalize_protocol_term(alias)
      from public.protocol_draft_items d, lateral unnest(d.aliases) alias
      where d.template_id = p_template_id and d.enabled
    )
    select 1 from terms group by normalized having count(distinct item_id) > 1
  ) then raise exception 'an alias collides with another protocol item' using errcode = '22023'; end if;

  v_next_version := v_template.current_published_version + 1;

  select jsonb_build_object(
    'protocolName', v_template.protocol_name,
    'treatmentLabel', v_template.treatment_label,
    'internalDescription', v_template.internal_description,
    'recoveryDurationDays', v_template.recovery_duration_days,
    'protocolTimeZone', v_template.protocol_timezone,
    'providerGuidance', v_template.provider_guidance,
    'routineRestoredMessage', v_template.routine_restored_message,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'itemKey', d.item_key,
      'canonicalName', d.canonical_name,
      'kind', d.kind,
      'category', d.category,
      'inventoryGroup', d.inventory_group,
      'clientExplanation', d.client_explanation,
      'providerNote', d.provider_note,
      'baselineAvailable', d.baseline_available,
      'returnDay', d.return_day,
      'aliases', to_jsonb(d.aliases),
      'ordinal', d.ordinal
    ) order by d.ordinal), '[]'::jsonb)
  ) into v_snapshot
  from public.protocol_draft_items d
  where d.template_id = p_template_id and d.enabled;

  insert into public.protocol_template_versions (
    id, template_id, provider_id, version, snapshot, change_summary, item_count
  ) values (
    v_version_id, p_template_id, v_provider, v_next_version, v_snapshot,
    coalesce(nullif(trim(p_change_summary), ''), case when v_next_version = 1 then 'Initial publication' else 'Provider-authored revision' end),
    v_item_count
  );

  insert into public.protocol_template_version_items (
    version_id, item_key, canonical_name, kind, category, inventory_group,
    client_explanation, provider_note, baseline_available, return_day, ordinal
  )
  select v_version_id, item_key, canonical_name, kind, category, inventory_group,
    client_explanation, provider_note, baseline_available, return_day, ordinal
  from public.protocol_draft_items
  where template_id = p_template_id and enabled
  order by ordinal;

  insert into public.protocol_template_version_aliases (version_item_id, alias, normalized_alias)
  select vi.id, trim(alias), private.normalize_protocol_term(alias)
  from public.protocol_draft_items d
  join public.protocol_template_version_items vi on vi.version_id = v_version_id and vi.item_key = d.item_key
  cross join lateral unnest(d.aliases) alias
  where d.template_id = p_template_id and d.enabled and trim(alias) <> '';

  insert into public.protocol_template_version_events (version_id, version_item_id, return_day, ordinal)
  select v_version_id, vi.id, vi.return_day,
    row_number() over (order by vi.return_day, vi.ordinal)::integer
  from public.protocol_template_version_items vi
  where vi.version_id = v_version_id and not vi.baseline_available and vi.return_day is not null;

  update public.protocol_templates set
    status = 'published',
    current_published_version = v_next_version,
    has_unpublished_changes = false,
    published_at = clock_timestamp(),
    archived_at = null
  where id = p_template_id;

  return jsonb_build_object('id', v_version_id, 'templateId', p_template_id, 'version', v_next_version, 'snapshot', v_snapshot);
end;
$$;

create or replace function public.archive_protocol_template(p_template_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid := (select auth.uid());
  v_name text;
begin
  if v_provider is null then raise exception 'authentication required' using errcode = '28000'; end if;
  update public.protocol_templates set status = 'archived', archived_at = clock_timestamp(), has_unpublished_changes = false
  where id = p_template_id and provider_id = v_provider and status <> 'archived'
  returning protocol_name into v_name;
  if v_name is null then raise exception 'protocol not found or already archived' using errcode = '42501'; end if;
  return jsonb_build_object('id', p_template_id, 'protocolName', v_name, 'archived', true);
end;
$$;

create or replace function public.issue_skin_pass_from_template(
  p_template_version_id uuid,
  p_client_name text,
  p_client_mobile text,
  p_treatment_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid := (select auth.uid());
  v_template public.protocol_templates%rowtype;
  v_version public.protocol_template_versions%rowtype;
  v_pass uuid := gen_random_uuid();
  v_public_id text;
  v_raw_token text;
  v_snapshot jsonb;
begin
  if v_provider is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if trim(coalesce(p_client_name, '')) = '' then raise exception 'client name is required' using errcode = '22023'; end if;

  select * into v_version from public.protocol_template_versions
  where id = p_template_version_id and provider_id = v_provider;
  if not found then raise exception 'published protocol version not found' using errcode = '42501'; end if;
  select * into v_template from public.protocol_templates
  where id = v_version.template_id and provider_id = v_provider for share;
  if not found or v_template.status <> 'published' then raise exception 'only published protocols can issue passes' using errcode = '23514'; end if;
  if v_template.archived_at is not null then raise exception 'archived protocols cannot issue passes' using errcode = '23514'; end if;

  loop
    v_public_id := private.make_public_pass_id();
    exit when not exists (select 1 from public.skin_passes where public_id = v_public_id);
  end loop;
  v_raw_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_snapshot := v_version.snapshot;

  insert into public.skin_passes (
    id, public_id, provider_id, template_version_id, client_name, client_mobile,
    treatment_key, treatment_name, treatment_date, status, provider_guidance,
    recovery_duration_days, routine_restored_message, protocol_timezone,
    issued_snapshot, protocol_version, issued_at
  ) values (
    v_pass, v_public_id, v_provider, v_version.id, trim(p_client_name), nullif(trim(coalesce(p_client_mobile, '')), ''),
    replace(private.normalize_protocol_term(v_template.protocol_name), ' ', '-'), v_template.treatment_label, p_treatment_date, 'issued',
    v_template.provider_guidance, v_template.recovery_duration_days, v_template.routine_restored_message,
    v_template.protocol_timezone, v_snapshot, 1, clock_timestamp()
  );

  insert into public.skin_pass_items (
    pass_id, item_key, item_label, kind, inventory_group, baseline_available,
    authored_return_at, provider_note, client_explanation, ordinal
  )
  select v_pass, vi.item_key, vi.canonical_name, vi.kind, vi.inventory_group, vi.baseline_available,
    case when vi.return_day is null then null else private.protocol_timestamp(p_treatment_date, vi.return_day, v_template.protocol_timezone) end,
    nullif(vi.provider_note, ''), nullif(vi.client_explanation, ''), vi.ordinal
  from public.protocol_template_version_items vi
  where vi.version_id = v_version.id
  order by vi.ordinal;

  insert into public.skin_pass_item_aliases (pass_item_id, alias, normalized_alias)
  select pi.id, va.alias, va.normalized_alias
  from public.protocol_template_version_aliases va
  join public.protocol_template_version_items vi on vi.id = va.version_item_id
  join public.skin_pass_items pi on pi.pass_id = v_pass and pi.item_key = vi.item_key
  where vi.version_id = v_version.id;

  insert into public.return_events (pass_id, pass_item_id, ordinal, return_at)
  select v_pass, pi.id, ve.ordinal,
    private.protocol_timestamp(p_treatment_date, ve.return_day, v_template.protocol_timezone)
  from public.protocol_template_version_events ve
  join public.protocol_template_version_items vi on vi.id = ve.version_item_id
  join public.skin_pass_items pi on pi.pass_id = v_pass and pi.item_key = vi.item_key
  where ve.version_id = v_version.id
  order by ve.ordinal;

  insert into public.protocol_versions (pass_id, version, authored_by, reason, snapshot)
  values (v_pass, 1, v_provider, 'Issued from template version ' || v_version.version, v_snapshot);
  insert into public.pass_access_tokens (pass_id, token_hash)
  values (v_pass, extensions.digest(v_raw_token, 'sha256'));
  insert into public.pass_audit_events (pass_id, provider_id, action, actor_kind, metadata)
  values (v_pass, v_provider, 'pass_issued', 'provider', jsonb_build_object(
    'publicId', v_public_id, 'templateId', v_template.id, 'templateVersion', v_version.version
  ));

  return jsonb_build_object(
    'id', v_pass,
    'publicId', v_public_id,
    'token', v_raw_token,
    'protocolVersion', 1,
    'templateVersion', v_version.version,
    'treatmentName', v_template.treatment_label
  );
end;
$$;

create or replace function public.lookup_skin_pass(p_public_id text, p_token text, p_ip_fingerprint text default 'unknown')
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
  v_template_version integer;
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

  update public.return_events set completed_at = return_at
  where pass_id = v_pass.id and completed_at is null and return_at <= v_now;
  update public.pass_access_tokens
  set last_verified_at = v_now, last_verified_ip_fingerprint = left(coalesce(p_ip_fingerprint, 'unknown'), 128)
  where id = v_token.id;
  select * into v_provider from public.provider_profiles where id = v_pass.provider_id;
  select version into v_template_version from public.protocol_template_versions where id = v_pass.template_version_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'key', i.item_key, 'label', i.item_label, 'kind', i.kind,
    'inventoryGroup', i.inventory_group, 'baselineAvailable', i.baseline_available,
    'authoredReturnAt', i.authored_return_at, 'providerNote', i.provider_note,
    'clientExplanation', i.client_explanation,
    'aliases', coalesce((select jsonb_agg(a.alias order by a.alias) from public.skin_pass_item_aliases a where a.pass_item_id = i.id), '[]'::jsonb)
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
    'protocolTimeZone', v_pass.protocol_timezone,
    'recoveryDurationDays', v_pass.recovery_duration_days,
    'routineRestoredMessage', v_pass.routine_restored_message,
    'templateVersion', v_template_version,
    'providerName', v_provider.studio_name, 'providerPhone', v_provider.mobile,
    'providerGuidance', v_pass.provider_guidance, 'protocolVersion', v_pass.protocol_version,
    'status', v_pass.status, 'items', v_items, 'events', v_events, 'versions', v_versions
  );
end;
$$;

revoke all on function public.save_protocol_draft(uuid, jsonb) from public, anon;
revoke all on function public.publish_protocol_template(uuid, text) from public, anon;
revoke all on function public.archive_protocol_template(uuid) from public, anon;
revoke all on function public.issue_skin_pass_from_template(uuid, text, text, date) from public, anon;
grant execute on function public.save_protocol_draft(uuid, jsonb) to authenticated;
grant execute on function public.publish_protocol_template(uuid, text) to authenticated;
grant execute on function public.archive_protocol_template(uuid) to authenticated;
grant execute on function public.issue_skin_pass_from_template(uuid, text, text, date) to authenticated;
revoke all on function public.lookup_skin_pass(text, text, text) from public;
grant execute on function public.lookup_skin_pass(text, text, text) to anon, authenticated;

-- Migrate Microneedling into the same provider-authored model without rewriting existing passes.
insert into public.protocol_templates (
  provider_id, protocol_name, treatment_label, internal_description, status,
  recovery_duration_days, protocol_timezone, provider_guidance, routine_restored_message,
  current_published_version, has_unpublished_changes, published_at
)
select p.id, 'Microneedling', 'Microneedling', 'Migrated from the first RE:ENTRY production slice.', 'published',
  7, 'America/Los_Angeles',
  'Use only the products and activities named in this Skin Pass. Contact the provider for symptoms or anything unexpected.',
  'Your full provider-authored routine is restored.', 1, false, clock_timestamp()
from public.provider_profiles p
where not exists (
  select 1 from public.protocol_templates t where t.provider_id = p.id and t.protocol_name = 'Microneedling'
);

insert into public.protocol_draft_items (
  template_id, item_key, canonical_name, kind, category, inventory_group,
  client_explanation, provider_note, baseline_available, return_day, aliases, ordinal, enabled
)
select t.id, seed.item_key, seed.canonical_name, seed.kind::public.pass_item_kind, seed.category,
  seed.inventory_group::public.pass_inventory_group, seed.client_explanation, '', seed.baseline_available,
  seed.return_day, seed.aliases, seed.ordinal, true
from public.protocol_templates t
cross join (values
  ('gentle-cleanser','Gentle cleanser','product','cleanser','routine','Use the gentle cleanser selected by your provider.',true,null,array['cleanser','face wash']::text[],0),
  ('barrier-moisturizer','Barrier moisturizer','product','moisturizer','routine','Keep the routine simple and barrier-focused.',true,null,array['moisturizer','barrier cream']::text[],1),
  ('mineral-spf','Mineral SPF','product','sun protection','routine','Use the provider-selected mineral sunscreen.',true,null,array['sunscreen','spf']::text[],2),
  ('intense-exercise','Intense exercise','activity','activity','activity','Follow the activity timing in this pass.',true,0,array['workout','gym']::text[],3),
  ('makeup','Makeup','product','cosmetic','routine','Wait until the scheduled return day.',false,3,array['foundation','concealer']::text[],4),
  ('exfoliating-acids','Exfoliating acids','product','active','routine','Wait until the scheduled return day.',false,5,array['aha','bha','glycolic acid']::text[],5),
  ('retinoid','Retinoid','product','active','routine','Wait until the scheduled return day.',false,7,array['retinol','tretinoin']::text[],6)
) as seed(item_key, canonical_name, kind, category, inventory_group, client_explanation, baseline_available, return_day, aliases, ordinal)
where t.protocol_name = 'Microneedling'
  and not exists (select 1 from public.protocol_draft_items d where d.template_id = t.id);

insert into public.protocol_template_versions (template_id, provider_id, version, snapshot, change_summary, item_count, published_at)
select t.id, t.provider_id, 1,
  jsonb_build_object(
    'protocolName', t.protocol_name,
    'treatmentLabel', t.treatment_label,
    'internalDescription', t.internal_description,
    'recoveryDurationDays', t.recovery_duration_days,
    'protocolTimeZone', t.protocol_timezone,
    'providerGuidance', t.provider_guidance,
    'routineRestoredMessage', t.routine_restored_message,
    'items', (select jsonb_agg(jsonb_build_object(
      'itemKey', d.item_key, 'canonicalName', d.canonical_name, 'kind', d.kind,
      'category', d.category, 'inventoryGroup', d.inventory_group,
      'clientExplanation', d.client_explanation, 'providerNote', d.provider_note,
      'baselineAvailable', d.baseline_available, 'returnDay', d.return_day,
      'aliases', to_jsonb(d.aliases), 'ordinal', d.ordinal
    ) order by d.ordinal) from public.protocol_draft_items d where d.template_id = t.id and d.enabled)
  ),
  'Migrated Microneedling protocol',
  (select count(*) from public.protocol_draft_items d where d.template_id = t.id and d.enabled),
  coalesce(t.published_at, clock_timestamp())
from public.protocol_templates t
where t.protocol_name = 'Microneedling'
  and not exists (select 1 from public.protocol_template_versions v where v.template_id = t.id and v.version = 1);

insert into public.protocol_template_version_items (
  version_id, item_key, canonical_name, kind, category, inventory_group,
  client_explanation, provider_note, baseline_available, return_day, ordinal
)
select v.id, d.item_key, d.canonical_name, d.kind, d.category, d.inventory_group,
  d.client_explanation, d.provider_note, d.baseline_available, d.return_day, d.ordinal
from public.protocol_template_versions v
join public.protocol_templates t on t.id = v.template_id and t.protocol_name = 'Microneedling'
join public.protocol_draft_items d on d.template_id = t.id and d.enabled
where v.version = 1
  and not exists (select 1 from public.protocol_template_version_items vi where vi.version_id = v.id);

insert into public.protocol_template_version_aliases (version_item_id, alias, normalized_alias)
select vi.id, trim(alias), private.normalize_protocol_term(alias)
from public.protocol_template_version_items vi
join public.protocol_template_versions v on v.id = vi.version_id and v.version = 1
join public.protocol_templates t on t.id = v.template_id and t.protocol_name = 'Microneedling'
join public.protocol_draft_items d on d.template_id = t.id and d.item_key = vi.item_key
cross join lateral unnest(d.aliases) alias
where trim(alias) <> ''
  and not exists (select 1 from public.protocol_template_version_aliases va where va.version_item_id = vi.id and va.normalized_alias = private.normalize_protocol_term(alias));

insert into public.protocol_template_version_events (version_id, version_item_id, return_day, ordinal)
select vi.version_id, vi.id, vi.return_day,
  row_number() over (partition by vi.version_id order by vi.return_day, vi.ordinal)::integer
from public.protocol_template_version_items vi
join public.protocol_template_versions v on v.id = vi.version_id and v.version = 1
join public.protocol_templates t on t.id = v.template_id and t.protocol_name = 'Microneedling'
where not vi.baseline_available and vi.return_day is not null
  and not exists (select 1 from public.protocol_template_version_events ve where ve.version_id = vi.version_id);

update public.skin_passes sp set
  template_version_id = v.id,
  recovery_duration_days = 7,
  routine_restored_message = 'Your full provider-authored routine is restored.'
from public.protocol_template_versions v
join public.protocol_templates t on t.id = v.template_id
where sp.provider_id = t.provider_id and sp.treatment_key = 'microneedling' and v.version = 1 and sp.template_version_id is null;

update public.skin_pass_items set client_explanation = case item_key
  when 'gentle-cleanser' then 'Use the gentle cleanser selected by your provider.'
  when 'barrier-moisturizer' then 'Keep the routine simple and barrier-focused.'
  when 'mineral-spf' then 'Use the provider-selected mineral sunscreen.'
  else 'Follow the provider-authored timing in this Skin Pass.' end
where client_explanation is null;

insert into public.skin_pass_item_aliases (pass_item_id, alias, normalized_alias)
select i.id, seed.alias, private.normalize_protocol_term(seed.alias)
from public.skin_pass_items i
join (values
  ('gentle-cleanser','cleanser'),('gentle-cleanser','face wash'),
  ('barrier-moisturizer','moisturizer'),('barrier-moisturizer','barrier cream'),
  ('mineral-spf','sunscreen'),('mineral-spf','spf'),
  ('intense-exercise','workout'),('intense-exercise','gym'),
  ('makeup','foundation'),('makeup','concealer'),
  ('exfoliating-acids','aha'),('exfoliating-acids','bha'),('exfoliating-acids','glycolic acid'),
  ('retinoid','retinol'),('retinoid','tretinoin')
) seed(item_key, alias) on seed.item_key = i.item_key
where not exists (
  select 1 from public.skin_pass_item_aliases a
  where a.pass_item_id = i.id and a.normalized_alias = private.normalize_protocol_term(seed.alias)
);

update public.skin_passes sp set issued_snapshot = jsonb_build_object(
  'treatmentLabel', sp.treatment_name,
  'treatmentDate', sp.treatment_date,
  'recoveryDurationDays', sp.recovery_duration_days,
  'protocolTimeZone', sp.protocol_timezone,
  'providerGuidance', sp.provider_guidance,
  'routineRestoredMessage', sp.routine_restored_message,
  'items', (select coalesce(jsonb_agg(jsonb_build_object(
    'itemKey', i.item_key, 'canonicalName', i.item_label, 'kind', i.kind,
    'inventoryGroup', i.inventory_group, 'clientExplanation', i.client_explanation,
    'providerNote', i.provider_note, 'baselineAvailable', i.baseline_available,
    'authoredReturnAt', i.authored_return_at,
    'aliases', coalesce((select jsonb_agg(a.alias order by a.alias) from public.skin_pass_item_aliases a where a.pass_item_id = i.id), '[]'::jsonb),
    'ordinal', i.ordinal
  ) order by i.ordinal), '[]'::jsonb) from public.skin_pass_items i where i.pass_id = sp.id)
)
where sp.issued_snapshot is null;
