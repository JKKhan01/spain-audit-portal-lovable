-- Drop the old working_patterns table and create a new one with day-specific patterns
DROP TABLE IF EXISTS public.working_patterns;

-- Create new working_patterns table with day-specific patterns
CREATE TABLE public.working_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 5), -- 1=Monday, 5=Friday
  default_start_time TIME WITHOUT TIME ZONE NOT NULL,
  default_end_time TIME WITHOUT TIME ZONE NOT NULL,
  lunch_duration INTEGER NOT NULL DEFAULT 30, -- lunch break in minutes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

-- Enable Row Level Security
ALTER TABLE public.working_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own patterns" 
ON public.working_patterns 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patterns" 
ON public.working_patterns 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns" 
ON public.working_patterns 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patterns" 
ON public.working_patterns 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_working_patterns_updated_at
BEFORE UPDATE ON public.working_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();