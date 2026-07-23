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

grant usage on schema private to authenticated;
grant execute on function private.protocol_timestamp(date,integer,text) to authenticated;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.issue_skin_pass(text,text,date,integer,integer,integer,integer)'::regprocedure)
  into definition;

  definition := replace(definition,
    '(p_treatment_date::timestamp at time zone ''UTC'') + make_interval(days => p_exercise_day)',
    'private.protocol_timestamp(p_treatment_date, p_exercise_day, ''America/Los_Angeles'')');
  definition := replace(definition,
    '(p_treatment_date::timestamp at time zone ''UTC'') + make_interval(days => p_makeup_day)',
    'private.protocol_timestamp(p_treatment_date, p_makeup_day, ''America/Los_Angeles'')');
  definition := replace(definition,
    '(p_treatment_date::timestamp at time zone ''UTC'') + make_interval(days => p_acids_day)',
    'private.protocol_timestamp(p_treatment_date, p_acids_day, ''America/Los_Angeles'')');
  definition := replace(definition,
    '(p_treatment_date::timestamp at time zone ''UTC'') + make_interval(days => p_retinoid_day)',
    'private.protocol_timestamp(p_treatment_date, p_retinoid_day, ''America/Los_Angeles'')');

  execute definition;
end $$;

alter function public.issue_skin_pass(text,text,date,integer,integer,integer,integer) security invoker;
