alter table public.skin_passes
add column if not exists protocol_timezone text not null default 'America/Los_Angeles';

comment on column public.skin_passes.protocol_timezone is
'Provider-authored IANA timezone used to map treatment-relative calendar days to server-controlled timestamps.';
