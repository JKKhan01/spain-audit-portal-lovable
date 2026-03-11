-- Add a restrictive policy to ensure unauthenticated users cannot access profiles
-- This policy will be AND'd with all other policies, ensuring authentication is always required
CREATE POLICY "Require authentication for all profile access"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
USING (auth.uid() IS NOT NULL);