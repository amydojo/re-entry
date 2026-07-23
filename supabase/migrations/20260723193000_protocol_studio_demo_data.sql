do $$
declare
  v_provider uuid;
  v_template uuid;
  v_v1 uuid;
  v_v2 uuid;
  v_pass uuid;
  v_snapshot jsonb;
begin
  select id into v_provider
  from public.provider_profiles
  order by created_at
  limit 1;

  if v_provider is null then
    raise exception 'Protocol Studio demonstration requires a provider profile';
  end if;

  select id into v_template
  from public.protocol_templates
  where provider_id = v_provider and protocol_name = 'Light Chemical Peel'
  order by created_at
  limit 1;

  if v_template is null then
    insert into public.protocol_templates (
      provider_id, protocol_name, treatment_label, internal_description, status,
      recovery_duration_days, protocol_timezone, provider_guidance,
      routine_restored_message
    ) values (
      v_provider,
      'Light Chemical Peel',
      'Light Chemical Peel',
      'Deterministic Protocol Studio production proof.',
      'draft',
      10,
      'America/Los_Angeles',
      'Use only the products and activities named in this Skin Pass. Contact the studio for symptoms, worsening discomfort, or anything unexpected.',
      'Your full provider-authored routine is restored.'
    ) returning id into v_template;
  end if;

  if not exists (select 1 from public.protocol_draft_items where template_id = v_template) then
    insert into public.protocol_draft_items (
      template_id, item_key, canonical_name, kind, category, inventory_group,
      client_explanation, provider_note, baseline_available, return_day,
      aliases, ordinal, enabled
    )
    select v_template, item_key, canonical_name, kind::public.pass_item_kind,
      category, inventory_group::public.pass_inventory_group,
      client_explanation, provider_note, baseline_available, return_day,
      aliases, ordinal, true
    from (values
      ('gentle-cleanser','Gentle cleanser','product','cleanser','routine','Use the gentle cleanser selected by your provider.','Keep cleansing brief and non-exfoliating.',true,null,array['cleanser','face wash']::text[],0),
      ('barrier-moisturizer','Barrier moisturizer','product','moisturizer','routine','Keep the routine simple and barrier-focused.','Use the provider-selected bland moisturizer.',true,null,array['moisturizer','barrier cream']::text[],1),
      ('mineral-spf','Mineral SPF','product','sun protection','routine','Use the provider-selected mineral sunscreen.','Reapply as directed by the provider.',true,null,array['sunscreen','spf']::text[],2),
      ('intense-exercise','Intense exercise','activity','activity','activity','Wait until the scheduled activity return day.','Avoid heat and heavy perspiration during the initial window.',false,2,array['workout','gym','running']::text[],3),
      ('makeup','Makeup','product','cosmetic','routine','Wait until the scheduled return day before applying complexion products.','Clean applicators before first use after treatment.',false,3,array['foundation','concealer']::text[],4),
      ('exfoliating-acids','Exfoliating acids','product','active','routine','Keep exfoliating acids held until their scheduled return.','Includes leave-on acid toners and treatment serums.',false,7,array['aha','bha','glycolic acid','salicylic acid']::text[],5),
      ('retinoid','Retinoid','product','active','routine','Keep retinoids held until the final scheduled return.','Includes prescription and over-the-counter vitamin A products.',false,10,array['retinol','tretinoin','adapalene']::text[],6)
    ) as seed(item_key, canonical_name, kind, category, inventory_group,
      client_explanation, provider_note, baseline_available, return_day, aliases, ordinal);
  end if;

  select id into v_v1
  from public.protocol_template_versions
  where template_id = v_template and version = 1;

  if v_v1 is null then
    v_v1 := gen_random_uuid();
    select jsonb_build_object(
      'protocolName', t.protocol_name,
      'treatmentLabel', t.treatment_label,
      'internalDescription', t.internal_description,
      'recoveryDurationDays', t.recovery_duration_days,
      'protocolTimeZone', t.protocol_timezone,
      'providerGuidance', t.provider_guidance,
      'routineRestoredMessage', t.routine_restored_message,
      'items', jsonb_agg(jsonb_build_object(
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
      ) order by d.ordinal)
    ) into v_snapshot
    from public.protocol_templates t
    join public.protocol_draft_items d on d.template_id = t.id and d.enabled
    where t.id = v_template
    group by t.id;

    insert into public.protocol_template_versions (
      id, template_id, provider_id, version, snapshot, change_summary, item_count
    ) values (
      v_v1, v_template, v_provider, 1, v_snapshot,
      'Initial provider-authored Light Chemical Peel edition.', 7
    );

    insert into public.protocol_template_version_items (
      version_id, item_key, canonical_name, kind, category, inventory_group,
      client_explanation, provider_note, baseline_available, return_day, ordinal
    )
    select v_v1, item_key, canonical_name, kind, category, inventory_group,
      client_explanation, provider_note, baseline_available, return_day, ordinal
    from public.protocol_draft_items
    where template_id = v_template and enabled
    order by ordinal;

    insert into public.protocol_template_version_aliases (
      version_item_id, alias, normalized_alias
    )
    select vi.id, alias, private.normalize_protocol_term(alias)
    from public.protocol_template_version_items vi
    join public.protocol_draft_items d
      on d.template_id = v_template and d.item_key = vi.item_key
    cross join lateral unnest(d.aliases) alias
    where vi.version_id = v_v1;

    insert into public.protocol_template_version_events (
      version_id, version_item_id, return_day, ordinal
    )
    select v_v1, id, return_day,
      row_number() over (order by return_day, ordinal)::integer
    from public.protocol_template_version_items
    where version_id = v_v1 and not baseline_available and return_day is not null;
  end if;

  update public.protocol_templates
  set status = 'published', current_published_version = 1,
      has_unpublished_changes = false, published_at = coalesce(published_at, clock_timestamp())
  where id = v_template and current_published_version < 1;

  if not exists (select 1 from public.skin_passes where public_id = 'SP-LCPV1') then
    v_pass := gen_random_uuid();
    select snapshot into v_snapshot from public.protocol_template_versions where id = v_v1;
    insert into public.skin_passes (
      id, public_id, provider_id, template_version_id, client_name,
      treatment_key, treatment_name, treatment_date, status, provider_guidance,
      recovery_duration_days, routine_restored_message, protocol_timezone,
      issued_snapshot, protocol_version, issued_at
    )
    select v_pass, 'SP-LCPV1', v_provider, v_v1, 'Edition One Client',
      'light-chemical-peel', treatment_label, date '2026-07-23', 'issued',
      provider_guidance, recovery_duration_days, routine_restored_message,
      protocol_timezone, v_snapshot, 1, clock_timestamp()
    from public.protocol_templates where id = v_template;

    insert into public.skin_pass_items (
      pass_id, item_key, item_label, kind, inventory_group,
      baseline_available, authored_return_at, provider_note,
      client_explanation, ordinal
    )
    select v_pass, item_key, canonical_name, kind, inventory_group,
      baseline_available,
      case when return_day is null then null
        else private.protocol_timestamp(date '2026-07-23', return_day, 'America/Los_Angeles') end,
      nullif(provider_note,''), nullif(client_explanation,''), ordinal
    from public.protocol_template_version_items where version_id = v_v1;

    insert into public.skin_pass_item_aliases(pass_item_id, alias, normalized_alias)
    select pi.id, va.alias, va.normalized_alias
    from public.protocol_template_version_aliases va
    join public.protocol_template_version_items vi on vi.id = va.version_item_id
    join public.skin_pass_items pi on pi.pass_id = v_pass and pi.item_key = vi.item_key
    where vi.version_id = v_v1;

    insert into public.return_events(pass_id, pass_item_id, ordinal, return_at)
    select v_pass, pi.id, ve.ordinal,
      private.protocol_timestamp(date '2026-07-23', ve.return_day, 'America/Los_Angeles')
    from public.protocol_template_version_events ve
    join public.protocol_template_version_items vi on vi.id = ve.version_item_id
    join public.skin_pass_items pi on pi.pass_id = v_pass and pi.item_key = vi.item_key
    where ve.version_id = v_v1;

    insert into public.protocol_versions(pass_id, version, authored_by, reason, snapshot)
    values (v_pass, 1, v_provider, 'Issued from template version 1', v_snapshot);
    insert into public.pass_access_tokens(pass_id, token_hash)
    values (v_pass, extensions.digest('lcp-v1-production-proof', 'sha256'));
    insert into public.pass_audit_events(pass_id, provider_id, action, actor_kind, metadata)
    values (v_pass, v_provider, 'pass_issued', 'provider', jsonb_build_object('templateVersion',1));
  end if;

  update public.protocol_draft_items
  set return_day = 9
  where template_id = v_template and item_key = 'retinoid';

  select id into v_v2
  from public.protocol_template_versions
  where template_id = v_template and version = 2;

  if v_v2 is null then
    v_v2 := gen_random_uuid();
    select jsonb_build_object(
      'protocolName', t.protocol_name,
      'treatmentLabel', t.treatment_label,
      'internalDescription', t.internal_description,
      'recoveryDurationDays', t.recovery_duration_days,
      'protocolTimeZone', t.protocol_timezone,
      'providerGuidance', t.provider_guidance,
      'routineRestoredMessage', t.routine_restored_message,
      'items', jsonb_agg(jsonb_build_object(
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
      ) order by d.ordinal)
    ) into v_snapshot
    from public.protocol_templates t
    join public.protocol_draft_items d on d.template_id = t.id and d.enabled
    where t.id = v_template
    group by t.id;

    insert into public.protocol_template_versions (
      id, template_id, provider_id, version, snapshot, change_summary, item_count
    ) values (
      v_v2, v_template, v_provider, 2, v_snapshot,
      'Move retinoid return to Day 9.', 7
    );

    insert into public.protocol_template_version_items (
      version_id, item_key, canonical_name, kind, category, inventory_group,
      client_explanation, provider_note, baseline_available, return_day, ordinal
    )
    select v_v2, item_key, canonical_name, kind, category, inventory_group,
      client_explanation, provider_note, baseline_available, return_day, ordinal
    from public.protocol_draft_items
    where template_id = v_template and enabled
    order by ordinal;

    insert into public.protocol_template_version_aliases (
      version_item_id, alias, normalized_alias
    )
    select vi.id, alias, private.normalize_protocol_term(alias)
    from public.protocol_template_version_items vi
    join public.protocol_draft_items d
      on d.template_id = v_template and d.item_key = vi.item_key
    cross join lateral unnest(d.aliases) alias
    where vi.version_id = v_v2;

    insert into public.protocol_template_version_events (
      version_id, version_item_id, return_day, ordinal
    )
    select v_v2, id, return_day,
      row_number() over (order by return_day, ordinal)::integer
    from public.protocol_template_version_items
    where version_id = v_v2 and not baseline_available and return_day is not null;
  end if;

  update public.protocol_templates
  set status = 'published', current_published_version = 2,
      has_unpublished_changes = false, published_at = clock_timestamp()
  where id = v_template;

  if not exists (select 1 from public.skin_passes where public_id = 'SP-LCPV2') then
    v_pass := gen_random_uuid();
    select snapshot into v_snapshot from public.protocol_template_versions where id = v_v2;
    insert into public.skin_passes (
      id, public_id, provider_id, template_version_id, client_name,
      treatment_key, treatment_name, treatment_date, status, provider_guidance,
      recovery_duration_days, routine_restored_message, protocol_timezone,
      issued_snapshot, protocol_version, issued_at
    )
    select v_pass, 'SP-LCPV2', v_provider, v_v2, 'Edition Two Client',
      'light-chemical-peel', treatment_label, date '2026-07-23', 'issued',
      provider_guidance, recovery_duration_days, routine_restored_message,
      protocol_timezone, v_snapshot, 1, clock_timestamp()
    from public.protocol_templates where id = v_template;

    insert into public.skin_pass_items (
      pass_id, item_key, item_label, kind, inventory_group,
      baseline_available, authored_return_at, provider_note,
      client_explanation, ordinal
    )
    select v_pass, item_key, canonical_name, kind, inventory_group,
      baseline_available,
      case when return_day is null then null
        else private.protocol_timestamp(date '2026-07-23', return_day, 'America/Los_Angeles') end,
      nullif(provider_note,''), nullif(client_explanation,''), ordinal
    from public.protocol_template_version_items where version_id = v_v2;

    insert into public.skin_pass_item_aliases(pass_item_id, alias, normalized_alias)
    select pi.id, va.alias, va.normalized_alias
    from public.protocol_template_version_aliases va
    join public.protocol_template_version_items vi on vi.id = va.version_item_id
    join public.skin_pass_items pi on pi.pass_id = v_pass and pi.item_key = vi.item_key
    where vi.version_id = v_v2;

    insert into public.return_events(pass_id, pass_item_id, ordinal, return_at)
    select v_pass, pi.id, ve.ordinal,
      private.protocol_timestamp(date '2026-07-23', ve.return_day, 'America/Los_Angeles')
    from public.protocol_template_version_events ve
    join public.protocol_template_version_items vi on vi.id = ve.version_item_id
    join public.skin_pass_items pi on pi.pass_id = v_pass and pi.item_key = vi.item_key
    where ve.version_id = v_v2;

    insert into public.protocol_versions(pass_id, version, authored_by, reason, snapshot)
    values (v_pass, 1, v_provider, 'Issued from template version 2', v_snapshot);
    insert into public.pass_access_tokens(pass_id, token_hash)
    values (v_pass, extensions.digest('lcp-v2-production-proof', 'sha256'));
    insert into public.pass_audit_events(pass_id, provider_id, action, actor_kind, metadata)
    values (v_pass, v_provider, 'pass_issued', 'provider', jsonb_build_object('templateVersion',2));
  end if;
end $$;
