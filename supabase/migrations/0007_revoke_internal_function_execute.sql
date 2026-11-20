-- These functions are called by triggers, policies or SECURITY DEFINER RPCs;
-- they are not application RPC endpoints.
revoke execute on function public.assert_active_user(public.user_role[]) from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
