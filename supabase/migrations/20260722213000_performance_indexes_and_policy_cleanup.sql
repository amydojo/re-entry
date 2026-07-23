create index if not exists pass_audit_events_provider_idx on public.pass_audit_events(provider_id) where provider_id is not null;
create index if not exists protocol_versions_authored_by_idx on public.protocol_versions(authored_by);
create index if not exists return_events_pass_item_idx on public.return_events(pass_item_id);
create index if not exists skin_passes_template_idx on public.skin_passes(template_id) where template_id is not null;

drop policy if exists template_items_owner_write on public.treatment_protocol_template_items;
create policy template_items_owner_insert on public.treatment_protocol_template_items
for insert to authenticated
with check (exists (
  select 1 from public.treatment_protocol_templates t
  where t.id = template_id and t.provider_id = (select auth.uid())
));
create policy template_items_owner_update on public.treatment_protocol_template_items
for update to authenticated
using (exists (
  select 1 from public.treatment_protocol_templates t
  where t.id = template_id and t.provider_id = (select auth.uid())
))
with check (exists (
  select 1 from public.treatment_protocol_templates t
  where t.id = template_id and t.provider_id = (select auth.uid())
));
create policy template_items_owner_delete on public.treatment_protocol_template_items
for delete to authenticated
using (exists (
  select 1 from public.treatment_protocol_templates t
  where t.id = template_id and t.provider_id = (select auth.uid())
));
