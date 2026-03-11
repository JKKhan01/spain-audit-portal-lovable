import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all users with auto_submit enabled
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('auto_submit', true);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No auto-submit users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ message: 'Weekend - skipped' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dateStr = today.toISOString().split('T')[0];
    let submittedCount = 0;

    for (const profile of profiles) {
      // Check if attendance already exists for today
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', profile.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (existing) continue; // Already submitted

      // Get working pattern for today's day of week
      const { data: pattern } = await supabase
        .from('working_patterns')
        .select('*')
        .eq('user_id', profile.id)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      // Get profile for working_hours fallback
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('working_hours')
        .eq('id', profile.id)
        .single();

      const workingHours = userProfile?.working_hours || 40;
      const isFullTime = workingHours >= 35;

      const startTime = pattern?.default_start_time || '08:00:00';
      const endTime = pattern?.default_end_time || (dayOfWeek === 5 ? (isFullTime ? '15:00:00' : '08:00:00') : (isFullTime ? '17:30:00' : '08:00:00'));
      const lunchDuration = pattern?.lunch_duration ?? (isFullTime ? 60 : 0);

      // Build timestamps
      const startParts = startTime.split(':').map(Number);
      const endParts = endTime.split(':').map(Number);

      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startParts[0], startParts[1] || 0);
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endParts[0], endParts[1] || 0);

      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          user_id: profile.id,
          date: dateStr,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          lunch_duration: lunchDuration,
        });

      if (!insertError) submittedCount++;
    }

    return new Response(JSON.stringify({ message: `Auto-submitted ${submittedCount} record(s)` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
