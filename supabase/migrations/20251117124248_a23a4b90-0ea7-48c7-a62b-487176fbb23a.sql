-- Remove the overly permissive policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Require authentication for all profile access" ON public.profiles;

-- The remaining policies are sufficient and secure:
-- 1. "Authenticated users can view their own profile" - users can see their own data
-- 2. "Authenticated admins can view all profiles" - admins can manage users