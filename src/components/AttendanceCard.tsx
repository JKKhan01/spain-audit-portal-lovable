import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AttendanceCardProps {
  userId: string;
  onAttendanceChange?: () => void;
}

const AttendanceCard = ({ userId, onAttendanceChange }: AttendanceCardProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendanceForDate, setAttendanceForDate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [clockInHour, setClockInHour] = useState("");
  const [clockInMinute, setClockInMinute] = useState("");
  const [clockOutHour, setClockOutHour] = useState("");
  const [clockOutMinute, setClockOutMinute] = useState("");
  const [defaultStartTime, setDefaultStartTime] = useState("");
  const [defaultEndTime, setDefaultEndTime] = useState("");
  const [lunchDuration, setLunchDuration] = useState(30);

  useEffect(() => {
    fetchAttendanceForDate();
    fetchWorkingPattern();
  }, [userId, selectedDate]);

  const fetchWorkingPattern = async () => {
    // Get day of week (1=Monday, 5=Friday, 0=Sunday, 6=Saturday)
    const dayOfWeek = selectedDate.getDay();
    // Convert to our format: 1=Monday, 5=Friday
    const adjustedDay = dayOfWeek === 0 ? 1 : dayOfWeek;
    
    // Only fetch for weekdays (Mon-Fri)
    if (adjustedDay < 1 || adjustedDay > 5) {
      return;
    }

    const { data, error } = await supabase
      .from("working_patterns")
      .select("*")
      .eq("user_id", userId)
      .eq("day_of_week", adjustedDay)
      .maybeSingle();

    if (data && !error) {
      setDefaultStartTime(data.default_start_time);
      setDefaultEndTime(data.default_end_time);
      setLunchDuration(data.lunch_duration);
      
      const startTime = new Date(`2000-01-01T${data.default_start_time}`);
      const endTime = new Date(`2000-01-01T${data.default_end_time}`);
      
      setClockInHour(startTime.getHours().toString().padStart(2, "0"));
      setClockInMinute(startTime.getMinutes().toString().padStart(2, "0"));
      setClockOutHour(endTime.getHours().toString().padStart(2, "0"));
      setClockOutMinute(endTime.getMinutes().toString().padStart(2, "0"));
    }
  };

  const fetchAttendanceForDate = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching attendance:", error);
      return;
    }

    setAttendanceForDate(data);
  };

  const handleClockIn = async () => {
    if (attendanceForDate) {
      toast.error("You have already clocked in for this date");
      return;
    }

    if (!clockInHour || !clockInMinute) {
      toast.error("Please select clock in time");
      return;
    }

    setLoading(true);

    const startTime = new Date(
      selectedDate.getFullYear(), 
      selectedDate.getMonth(), 
      selectedDate.getDate(), 
      parseInt(clockInHour), 
      parseInt(clockInMinute)
    );

    const { error } = await supabase.from("attendance").insert({
      user_id: userId,
      date: format(selectedDate, "yyyy-MM-dd"),
      start_time: startTime.toISOString(),
      lunch_duration: lunchDuration,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to clock in");
      return;
    }

    toast.success("Clocked in successfully!");
    fetchAttendanceForDate();
    onAttendanceChange?.();
  };

  const handleClockOut = async () => {
    if (!attendanceForDate) {
      toast.error("Please clock in first");
      return;
    }

    if (attendanceForDate.end_time) {
      toast.error("You have already clocked out for this date");
      return;
    }

    if (!clockOutHour || !clockOutMinute) {
      toast.error("Please select clock out time");
      return;
    }

    setLoading(true);

    const endTime = new Date(
      selectedDate.getFullYear(), 
      selectedDate.getMonth(), 
      selectedDate.getDate(), 
      parseInt(clockOutHour), 
      parseInt(clockOutMinute)
    );

    const startTime = new Date(attendanceForDate.start_time);
    
    if (endTime <= startTime) {
      toast.error("Clock out time must be after clock in time");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("attendance")
      .update({
        end_time: endTime.toISOString(),
      })
      .eq("id", attendanceForDate.id);

    setLoading(false);

    if (error) {
      toast.error("Failed to clock out");
      return;
    }

    toast.success("Clocked out successfully!");
    fetchAttendanceForDate();
    onAttendanceChange?.();
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4 text-primary" />
          Clock In/Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Date:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[180px] justify-start text-left font-normal h-8 text-sm">
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Clock In Time</label>
              <div className="flex gap-2">
                <Select value={clockInHour} onValueChange={setClockInHour} disabled={!!attendanceForDate}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={clockInMinute} onValueChange={setClockInMinute} disabled={!!attendanceForDate}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleClockIn} 
              disabled={!!attendanceForDate || !clockInHour || !clockInMinute || loading}
              className="w-full h-8 text-sm"
              size="sm"
            >
              Clock In
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Clock Out Time</label>
              <div className="flex gap-2">
                <Select value={clockOutHour} onValueChange={setClockOutHour} disabled={!attendanceForDate || !!attendanceForDate?.end_time}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={clockOutMinute} onValueChange={setClockOutMinute} disabled={!attendanceForDate || !!attendanceForDate?.end_time}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleClockOut}
              disabled={!attendanceForDate || !!attendanceForDate?.end_time || !clockOutHour || !clockOutMinute || loading}
              className="w-full h-8 text-sm"
              variant="secondary"
              size="sm"
            >
              Clock Out
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lunch-duration" className="text-sm font-medium">
            Lunch Break Duration (minutes)
          </Label>
          <Input
            id="lunch-duration"
            type="number"
            min="0"
            step="15"
            value={lunchDuration}
            onChange={(e) => setLunchDuration(parseInt(e.target.value) || 0)}
            disabled={!!attendanceForDate}
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            This will be deducted from your total hours
          </p>
        </div>

        {attendanceForDate && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status for {format(selectedDate, "MMM dd")}:</span>
              <span className={attendanceForDate.end_time ? "text-success" : "text-primary font-medium"}>
                {attendanceForDate.end_time ? "Completed" : "Clocked In"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceCard;
