import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

interface WorkingPattern {
  id: string;
  day_of_week: number;
  default_start_time: string;
  default_end_time: string;
  lunch_duration: number;
}

interface PatternFormData {
  start: string;
  end: string;
  lunch: number;
}

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patterns, setPatterns] = useState<WorkingPattern[]>([]);
  const [workingHours, setWorkingHours] = useState<number>(40);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [formData, setFormData] = useState<Record<number, PatternFormData>>({});

  const daysOfWeek = [
    { day: 1, label: "Mon" },
    { day: 2, label: "Tue" },
    { day: 3, label: "Wed" },
    { day: 4, label: "Thu" },
    { day: 5, label: "Fri" },
  ];

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: profile } = await supabase
          .from("profiles")
          .select("working_hours, auto_submit")
          .eq("id", session.user.id)
          .single();
        if (profile) {
          setWorkingHours(profile.working_hours || 40);
          setAutoSubmit(profile.auto_submit || false);
        }
        await fetchPatterns(session.user.id);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    // Initialize form data from patterns
    const data: Record<number, PatternFormData> = {};
    for (const { day } of daysOfWeek) {
      const pattern = getPatternForDay(day);
      data[day] = {
        start: pattern?.default_start_time || "09:00",
        end: pattern?.default_end_time || "17:00",
        lunch: pattern?.lunch_duration ?? 30,
      };
    }
    setFormData(data);
  }, [patterns, workingHours]);

  const fetchPatterns = async (userId: string) => {
    const { data, error } = await supabase
      .from("working_patterns")
      .select("*")
      .eq("user_id", userId)
      .order("day_of_week", { ascending: true });
    if (error) { console.error("Error fetching patterns:", error); return; }
    setPatterns(data || []);
  };

  const getPatternForDay = (day: number): WorkingPattern | null => {
    const existing = patterns.find(p => p.day_of_week === day);
    if (existing) return existing;
    const isFullTime = workingHours >= 35;
    const lunchDuration = isFullTime ? 60 : 0;
    return {
      id: '',
      day_of_week: day,
      default_start_time: '08:00',
      default_end_time: day === 5 ? (isFullTime ? '15:00' : '08:00') : (isFullTime ? '17:30' : '08:00'),
      lunch_duration: lunchDuration,
    };
  };

  const updateField = (day: number, field: keyof PatternFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);

    try {
      for (const { day } of daysOfWeek) {
        const fd = formData[day];
        if (!fd?.start || !fd?.end) continue;

        const existing = patterns.find(p => p.day_of_week === day);

        if (existing) {
          const { error } = await supabase
            .from("working_patterns")
            .update({
              default_start_time: fd.start,
              default_end_time: fd.end,
              lunch_duration: fd.lunch,
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("working_patterns")
            .insert({
              user_id: user.id,
              day_of_week: day,
              default_start_time: fd.start,
              default_end_time: fd.end,
              lunch_duration: fd.lunch,
            });
          if (error) throw error;
        }
      }

      // Save auto_submit preference
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ auto_submit: autoSubmit })
        .eq("id", user.id);
      if (profileError) throw profileError;

      toast.success("Settings saved");
      await fetchPatterns(user.id);
    } catch (error) {
      console.error(error);
      toast.error("Error saving patterns");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="h-8">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-lg font-bold">Settings</h1>
          </div>
          <Button size="sm" onClick={handleSaveAll} disabled={saving} className="h-8">
            <Save className="h-3 w-3 mr-1.5" />
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Working Hours & Breaks</CardTitle>
            <p className="text-xs text-muted-foreground">
              Configure your default start/end times and lunch break for each day.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Day</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Start</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">End</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Break (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {daysOfWeek.map(({ day, label }) => (
                    <tr key={day} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 px-3 font-medium">{label}</td>
                      <td className="p-2 px-3">
                        <Input
                          type="time"
                          value={formData[day]?.start || ""}
                          onChange={(e) => updateField(day, "start", e.target.value)}
                          className="h-8 w-[110px] text-sm"
                        />
                      </td>
                      <td className="p-2 px-3">
                        <Input
                          type="time"
                          value={formData[day]?.end || ""}
                          onChange={(e) => updateField(day, "end", e.target.value)}
                          className="h-8 w-[110px] text-sm"
                        />
                      </td>
                      <td className="p-2 px-3">
                        <Input
                          type="number"
                          min="0"
                          step="15"
                          value={formData[day]?.lunch ?? 30}
                          onChange={(e) => updateField(day, "lunch", parseInt(e.target.value) || 0)}
                          className="h-8 w-[80px] text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Automation</CardTitle>
            <p className="text-xs text-muted-foreground">
              Configure automatic attendance submission.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-submit" className="text-sm font-medium">Enable Auto Submit</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically submit attendance each day using your default working pattern at the configured end time.
                </p>
              </div>
              <Switch
                id="auto-submit"
                checked={autoSubmit}
                onCheckedChange={setAutoSubmit}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
