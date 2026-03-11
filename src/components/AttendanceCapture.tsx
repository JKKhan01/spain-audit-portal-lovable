import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, CalendarIcon, Save, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface AttendanceCaptureProps {
  userId: string;
  onAttendanceChange?: () => void;
}

interface WorkingPattern {
  day_of_week: number;
  default_start_time: string;
  default_end_time: string;
  lunch_duration: number;
}

interface DayEntry {
  date: Date;
  dayLabel: string;
  startTime: string;
  endTime: string;
  lunchDuration: number;
  existingId: string | null;
  hasEndTime: boolean;
  dirty: boolean;
}

const AttendanceCapture = ({ userId, onAttendanceChange }: AttendanceCaptureProps) => {
  const [activeTab, setActiveTab] = useState("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [patterns, setPatterns] = useState<WorkingPattern[]>([]);
  const [workingHours, setWorkingHours] = useState(40);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weekLoadKey, setWeekLoadKey] = useState(0);

  // Day mode state
  const [dayEntry, setDayEntry] = useState<DayEntry | null>(null);

  // Week mode state
  const [weekEntries, setWeekEntries] = useState<DayEntry[]>([]);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const fetchPatterns = useCallback(async () => {
    const [patternsRes, profileRes] = await Promise.all([
      supabase.from("working_patterns").select("*").eq("user_id", userId),
      supabase.from("profiles").select("working_hours, auto_submit").eq("id", userId).single(),
    ]);
    if (patternsRes.data) setPatterns(patternsRes.data);
    if (profileRes.data) {
      setWorkingHours(profileRes.data.working_hours || 40);
      setAutoSubmit(profileRes.data.auto_submit || false);
    }
  }, [userId]);

  useEffect(() => { fetchPatterns(); }, [fetchPatterns]);

  const getDefaultPattern = useCallback((dayOfWeek: number): { start: string; end: string; lunch: number } => {
    const existing = patterns.find(p => p.day_of_week === dayOfWeek);
    if (existing) return { start: existing.default_start_time.slice(0, 5), end: existing.default_end_time.slice(0, 5), lunch: existing.lunch_duration };
    const isFullTime = workingHours >= 35;
    return {
      start: "08:00",
      end: dayOfWeek === 5 ? (isFullTime ? "15:00" : "08:00") : (isFullTime ? "17:30" : "08:00"),
      lunch: isFullTime ? 60 : 0,
    };
  }, [patterns, workingHours]);

  // Fetch day entry
  useEffect(() => {
    const loadDay = async () => {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const dow = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
      const defaults = getDefaultPattern(dow);

      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("date", dateStr)
        .maybeSingle();

      if (data) {
        setDayEntry({
          date: selectedDate,
          dayLabel: format(selectedDate, "EEE"),
          startTime: format(new Date(data.start_time), "HH:mm"),
          endTime: data.end_time ? format(new Date(data.end_time), "HH:mm") : defaults.end,
          lunchDuration: data.lunch_duration,
          existingId: data.id,
          hasEndTime: !!data.end_time,
          dirty: false,
        });
      } else {
        setDayEntry({
          date: selectedDate,
          dayLabel: format(selectedDate, "EEE"),
          startTime: defaults.start,
          endTime: defaults.end,
          lunchDuration: defaults.lunch,
          existingId: null,
          hasEndTime: false,
          dirty: false,
        });
      }
    };
    loadDay();
  }, [selectedDate, userId, getDefaultPattern]);

  // Fetch week entries - also reloads when weekLoadKey changes (tab switch)
  useEffect(() => {
    const loadWeek = async () => {
      const dates = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
      const startStr = format(dates[0], "yyyy-MM-dd");
      const endStr = format(dates[4], "yyyy-MM-dd");

      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startStr)
        .lte("date", endStr);

      const entries: DayEntry[] = dates.map((date, i) => {
        const dow = i + 1;
        const defaults = getDefaultPattern(dow);
        const dateStr = format(date, "yyyy-MM-dd");
        const existing = data?.find(r => r.date === dateStr);

        if (existing) {
          return {
            date,
            dayLabel: daysOfWeek[i],
            startTime: format(new Date(existing.start_time), "HH:mm"),
            endTime: existing.end_time ? format(new Date(existing.end_time), "HH:mm") : defaults.end,
            lunchDuration: existing.lunch_duration,
            existingId: existing.id,
            hasEndTime: !!existing.end_time,
            dirty: false,
          };
        }
        return {
          date,
          dayLabel: daysOfWeek[i],
          startTime: defaults.start,
          endTime: defaults.end,
          lunchDuration: defaults.lunch,
          existingId: null,
          hasEndTime: false,
          dirty: false,
        };
      });

      setWeekEntries(entries);
    };
    loadWeek();
  }, [weekStart, userId, getDefaultPattern, weekLoadKey]);

  // Reload week data when switching to week tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "week") {
      setWeekLoadKey(prev => prev + 1);
    }
  };

  const saveDayEntry = async (entry: DayEntry) => {
    const dateStr = format(entry.date, "yyyy-MM-dd");
    const startTime = new Date(entry.date.getFullYear(), entry.date.getMonth(), entry.date.getDate(),
      parseInt(entry.startTime.split(":")[0]), parseInt(entry.startTime.split(":")[1]));
    const endTime = new Date(entry.date.getFullYear(), entry.date.getMonth(), entry.date.getDate(),
      parseInt(entry.endTime.split(":")[0]), parseInt(entry.endTime.split(":")[1]));

    if (endTime <= startTime) {
      toast.error(`Clock out must be after clock in for ${format(entry.date, "MMM dd")}`);
      return false;
    }

    if (entry.existingId) {
      const { error } = await supabase
        .from("attendance")
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          lunch_duration: entry.lunchDuration,
        })
        .eq("id", entry.existingId);
      if (error) { toast.error("Failed to update"); return false; }
    } else {
      const { error } = await supabase.from("attendance").insert({
        user_id: userId,
        date: dateStr,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        lunch_duration: entry.lunchDuration,
      });
      if (error) { toast.error("Failed to save"); return false; }
    }
    return true;
  };

  const handleSaveDay = async () => {
    if (!dayEntry) return;
    setSaving(true);
    const ok = await saveDayEntry(dayEntry);
    setSaving(false);
    if (ok) {
      toast.success("Saved!");
      setDayEntry(prev => prev ? { ...prev, dirty: false, existingId: prev.existingId || "saved" } : null);
      onAttendanceChange?.();
    }
  };

  const handleSaveWeek = async () => {
    setSaving(true);
    // Save all entries (dirty or not, since defaults should be saveable)
    let allOk = true;
    let savedCount = 0;
    for (const entry of weekEntries) {
      const ok = await saveDayEntry(entry);
      if (!ok) { allOk = false; break; }
      savedCount++;
    }
    setSaving(false);
    if (allOk) {
      toast.success(`Saved ${savedCount} day(s)`);
      setWeekLoadKey(prev => prev + 1);
      onAttendanceChange?.();
    }
  };

  const updateWeekEntry = (index: number, field: keyof DayEntry, value: string | number) => {
    setWeekEntries(prev => prev.map((e, i) =>
      i === index ? { ...e, [field]: value, dirty: true } : e
    ));
  };

  const calcDuration = (start: string, end: string, lunch: number) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const totalMin = (eh * 60 + em) - (sh * 60 + sm) - lunch;
    if (totalMin <= 0) return "--";
    return `${Math.floor(totalMin / 60)}h${(totalMin % 60).toString().padStart(2, "0")}`;
  };

  const weekLabel = `${format(weekStart, "MMM dd")} – ${format(addDays(weekStart, 4), "MMM dd, yyyy")}`;
  const isDisabled = autoSubmit;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" />
            Attendance Entry
          </CardTitle>
          {isDisabled && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded">
              <Info className="w-3 h-3" />
              Auto Submit enabled
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full mb-3">
            <TabsTrigger value="day" className="flex-1 text-xs">By Day</TabsTrigger>
            <TabsTrigger value="week" className="flex-1 text-xs">By Week</TabsTrigger>
          </TabsList>

          {/* DAY TAB */}
          <TabsContent value="day" className="space-y-3 mt-0">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isDisabled}>
                    <CalendarIcon className="h-3 w-3 mr-1.5" />
                    {format(selectedDate, "EEE, MMM dd yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {dayEntry?.existingId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Saved</span>
              )}
            </div>

            {dayEntry && (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-8 px-3 text-left text-xs font-medium text-muted-foreground">Start</th>
                      <th className="h-8 px-3 text-left text-xs font-medium text-muted-foreground">End</th>
                      <th className="h-8 px-3 text-left text-xs font-medium text-muted-foreground">Break</th>
                      <th className="h-8 px-3 text-left text-xs font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-1.5 px-3">
                        <Input type="time" value={dayEntry.startTime}
                          onChange={e => setDayEntry(prev => prev ? { ...prev, startTime: e.target.value, dirty: true } : null)}
                          className="h-7 w-[100px] text-xs" disabled={isDisabled} />
                      </td>
                      <td className="p-1.5 px-3">
                        <Input type="time" value={dayEntry.endTime}
                          onChange={e => setDayEntry(prev => prev ? { ...prev, endTime: e.target.value, dirty: true } : null)}
                          className="h-7 w-[100px] text-xs" disabled={isDisabled} />
                      </td>
                      <td className="p-1.5 px-3">
                        <Input type="number" min="0" step="15" value={dayEntry.lunchDuration}
                          onChange={e => setDayEntry(prev => prev ? { ...prev, lunchDuration: parseInt(e.target.value) || 0, dirty: true } : null)}
                          className="h-7 w-[65px] text-xs" disabled={isDisabled} />
                      </td>
                      <td className="p-1.5 px-3 text-xs font-medium">
                        {calcDuration(dayEntry.startTime, dayEntry.endTime, dayEntry.lunchDuration)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <Button size="sm" className="h-7 text-xs w-full" onClick={handleSaveDay}
              disabled={saving || !dayEntry?.dirty || isDisabled}>
              <Save className="h-3 w-3 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </TabsContent>

          {/* WEEK TAB */}
          <TabsContent value="week" className="space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => setWeekStart(addDays(weekStart, -7))} disabled={isDisabled}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium">{weekLabel}</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={isDisabled}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground w-[52px]">Day</th>
                    <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground">Start</th>
                    <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground">End</th>
                    <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground">Break</th>
                    <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {weekEntries.map((entry, i) => {
                    const isToday = isSameDay(entry.date, new Date());
                    return (
                      <tr key={i} className={cn("border-b last:border-0", isToday && "bg-primary/5")}>
                        <td className="p-1.5 px-2">
                          <div className="text-xs font-medium">{entry.dayLabel}</div>
                          <div className="text-[10px] text-muted-foreground">{format(entry.date, "dd")}</div>
                        </td>
                        <td className="p-1.5 px-2">
                          <Input type="time" value={entry.startTime}
                            onChange={e => updateWeekEntry(i, "startTime", e.target.value)}
                            className="h-7 w-[90px] text-xs" disabled={isDisabled} />
                        </td>
                        <td className="p-1.5 px-2">
                          <Input type="time" value={entry.endTime}
                            onChange={e => updateWeekEntry(i, "endTime", e.target.value)}
                            className="h-7 w-[90px] text-xs" disabled={isDisabled} />
                        </td>
                        <td className="p-1.5 px-2">
                          <Input type="number" min="0" step="15" value={entry.lunchDuration}
                            onChange={e => updateWeekEntry(i, "lunchDuration", parseInt(e.target.value) || 0)}
                            className="h-7 w-[55px] text-xs" disabled={isDisabled} />
                        </td>
                        <td className="p-1.5 px-2 text-xs font-medium">
                          {calcDuration(entry.startTime, entry.endTime, entry.lunchDuration)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button size="sm" className="h-7 text-xs w-full" onClick={handleSaveWeek}
              disabled={saving || isDisabled}>
              <Save className="h-3 w-3 mr-1" />
              {saving ? "Saving..." : "Save Week"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AttendanceCapture;
