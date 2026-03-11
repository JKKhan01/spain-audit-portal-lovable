
CREATE OR REPLACE TRIGGER audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE OR REPLACE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE OR REPLACE TRIGGER audit_working_patterns
  AFTER INSERT OR UPDATE OR DELETE ON public.working_patterns
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE OR REPLACE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
