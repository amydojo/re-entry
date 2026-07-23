-- Run against a linked test project. The statements are read-only except for a rolled-back fixture.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'provider_profiles','treatment_protocol_templates','treatment_protocol_template_items',
    'skin_passes','skin_pass_items','return_events','protocol_versions','pass_access_tokens','pass_audit_events'
  )
order by tablename;

select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name, privilege_type;

select public.lookup_skin_pass('SP-0042', 'wrong-token-value', 'rls-test') ->> 'access' as wrong_token_access;

begin;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select count(*) as other_provider_rows_visible from public.skin_passes;
rollback;
