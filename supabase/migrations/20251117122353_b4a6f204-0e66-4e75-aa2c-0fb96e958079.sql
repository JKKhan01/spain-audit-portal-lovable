-- Add working_hours column to profiles table
ALTER TABLE public.profiles
ADD COLUMN working_hours integer NOT NULL DEFAULT 40;

-- Add constraint to ensure working hours is positive
ALTER TABLE public.profiles
ADD CONSTRAINT working_hours_positive CHECK (working_hours > 0);