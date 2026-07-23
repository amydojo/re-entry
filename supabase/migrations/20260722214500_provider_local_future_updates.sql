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
  v_new_calendar_date date;
  v_effective_return_at timestamptz;
begin
  select * into v_pass from public.skin_passes where id = p_pass_id and provider_id = v_provider for update;
  if not found then raise exception 'pass not found' using errcode = '42501'; end if;
  if v_pass.status <> 'issued' then raise exception 'only active issued passes can be updated' using errcode = '23514'; end if;

  select * into v_event from public.return_events where id = p_event_id and pass_id = p_pass_id for update;
  if not found then raise exception 'event not found' using errcode = '22023'; end if;
  if v_event.completed_at is not null or v_event.return_at <= clock_timestamp() then
    raise exception 'only future events may be edited' using errcode = '23514';
  end if;

  v_new_calendar_date := (p_new_return_at at time zone 'UTC')::date;
  v_effective_return_at := (v_new_calendar_date::timestamp at time zone v_pass.protocol_timezone);
  if v_effective_return_at <= clock_timestamp() then
    raise exception 'new return date must remain in the future' using errcode = '23514';
  end if;

  select item_label into v_item_label from public.skin_pass_items where id = v_event.pass_item_id;
  update public.return_events set return_at = v_effective_return_at where id = p_event_id;
  update public.skin_pass_items set authored_return_at = v_effective_return_at where id = v_event.pass_item_id;
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
    v_event.return_at, v_effective_return_at, v_snapshot
  );
  insert into public.pass_audit_events (pass_id, provider_id, action, actor_kind, metadata)
  values (p_pass_id, v_provider, 'protocol_updated', 'provider', jsonb_build_object(
    'item', v_item_label, 'previousReturnAt', v_event.return_at, 'newReturnAt', v_effective_return_at, 'version', v_next_version
  ));
  return jsonb_build_object('version', v_next_version, 'itemLabel', v_item_label, 'previousReturnAt', v_event.return_at, 'newReturnAt', v_effective_return_at);
end;
$$;
revoke all on function public.publish_protocol_update(uuid,uuid,timestamptz,text) from public, anon;
grant execute on function public.publish_protocol_update(uuid,uuid,timestamptz,text) to authenticated;
