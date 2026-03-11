-- Add lunch_duration column to attendance table
ALTER TABLE public.attendance
ADD COLUMN lunch_duration INTEGER NOT NULL DEFAULT 30;