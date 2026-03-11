import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Calendar } from "lucide-react";

interface AttendanceTableProps {
  userId: string;
  refreshTrigger?: number;
}

const AttendanceTable = ({ userId, refreshTrigger }: AttendanceTableProps) => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  useEffect(() => {
    fetchAttendance();
  }, [userId, selectedYear, selectedMonth, refreshTrigger]);

  const fetchAttendance = async () => {
    setLoading(true);

    const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
    const monthStart = format(startOfMonth(targetDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(targetDate), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    setLoading(false);

    if (error) {
      console.error("Error fetching attendance:", error);
      return;
    }

    setAttendance(data || []);
  };

  const calculateDuration = (startTime: string, endTime: string | null, lunchMinutes: number = 30) => {
    if (!endTime) return "In Progress";

    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end.getTime() - start.getTime();
    
    // Subtract lunch break
    const totalMinutes = Math.floor(diff / (1000 * 60)) - lunchMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4 text-sm">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-primary" />
            Monthly Attendance
          </CardTitle>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {attendance.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-sm">
            No attendance records for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Clock In</TableHead>
                  <TableHead className="text-xs">Clock Out</TableHead>
                  <TableHead className="text-xs">Breaks</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium text-sm py-2">
                      {format(new Date(record.date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm py-2">
                      {format(new Date(record.start_time), "HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm py-2">
                      {record.end_time
                        ? format(new Date(record.end_time), "HH:mm")
                        : "--:--"}
                    </TableCell>
                    <TableCell className="text-sm py-2">
                      {record.lunch_duration || 30} min
                    </TableCell>
                    <TableCell className="text-sm py-2">
                      {calculateDuration(record.start_time, record.end_time, record.lunch_duration || 30)}
                    </TableCell>
                    <TableCell className="py-2">
                      {record.end_time ? (
                        <Badge variant="secondary" className="text-xs">Completed</Badge>
                      ) : (
                        <Badge className="bg-success text-success-foreground text-xs">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceTable;
