grant usage on schema private to authenticated;
grant execute on function private.make_public_pass_id() to authenticated;
grant execute on function private.protocol_timestamp(date,integer,text) to authenticated;
alter function public.issue_skin_pass(text,text,date,integer,integer,integer,integer) security invoker;
