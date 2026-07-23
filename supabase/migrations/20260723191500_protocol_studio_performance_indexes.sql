create index if not exists protocol_template_versions_provider_idx
  on public.protocol_template_versions(provider_id);

create index if not exists protocol_template_version_events_item_idx
  on public.protocol_template_version_events(version_item_id);
