-- PostgreSQL grants function execution to PUBLIC by default. This workflow
-- writes product data, so expose it only to authenticated command-center users.

revoke all on function public.approve_strategist_recommendation(text, text) from public;
revoke all on function public.approve_strategist_recommendation(text, text) from anon;
grant execute on function public.approve_strategist_recommendation(text, text) to authenticated;
