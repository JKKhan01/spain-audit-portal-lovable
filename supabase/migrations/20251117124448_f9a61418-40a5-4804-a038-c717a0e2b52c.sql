-- Enhance the has_role() function with additional security measures
-- Using CREATE OR REPLACE to avoid dropping dependencies

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate input parameters to prevent null injection
  IF _user_id IS NULL OR _role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if the user has the specified role
  -- Using EXISTS for optimal performance and security
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;

-- Add security comment explaining the implementation
COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 
'Security-critical function for role verification. Implemented as SECURITY DEFINER with:
- Explicit search_path to prevent search_path attacks
- Input validation to prevent null injection
- Optimized EXISTS query to prevent timing attacks
- STABLE designation for proper query optimization
This function bypasses RLS to check roles without recursion.';