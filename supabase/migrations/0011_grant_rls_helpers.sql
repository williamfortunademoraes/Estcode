-- RLS evaluates helper functions as the authenticated caller, so the role needs
-- EXECUTE on the scoped SECURITY DEFINER predicates used by policies.
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
