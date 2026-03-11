import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Download, FileSpreadsheet, Users, History } from "lucide-react";
import * as XLSX from "@e965/xlsx";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { NavLink } from "@/components/NavLink";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { AuditTrail } from "@/components/AuditTrail";
import { KeyrusLogo } from "@/components/KeyrusLogo";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  lunch_duration: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && profiles.length > 0) {
      fetchAttendanceData();
    }
  }, [isAdmin, selectedYear, selectedMonth, selectedUsers, profiles]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");

    if (error) {
      console.error("Error fetching profiles:", error);
      toast.error("Failed to load users");
      return;
    }

    setProfiles(data || []);
  };

  const fetchAttendanceData = async () => {
    setLoading(true);

    const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
    const startDate = startOfMonth(targetDate);
    const endDate = endOfMonth(targetDate);

    let query = supabase
      .from("attendance")
      .select("*")
      .gte("date", format(startDate, "yyyy-MM-dd"))
      .lte("date", format(endDate, "yyyy-MM-dd"))
      .order("date", { ascending: true })
      .order("user_id", { ascending: true });

    if (selectedUsers.length > 0) {
      query = query.in("user_id", selectedUsers);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error("Error fetching attendance data:", error);
      toast.error("Failed to load attendance data");
      return;
    }

    setAttendanceData(data || []);
  };

  const calculateDuration = (startTime: string, endTime: string | null, lunchMinutes: number = 30) => {
    if (!endTime) return 0;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end.getTime() - start.getTime();
    const totalHours = diff / (1000 * 60 * 60);
    const lunchHours = lunchMinutes / 60;
    return totalHours - lunchHours;
  };

  const downloadExcel = () => {
    if (attendanceData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = attendanceData.map((record) => {
      const profile = profiles.find((p) => p.id === record.user_id);
      return {
        Employee: profile?.full_name || profile?.email || "Unknown",
        Date: format(new Date(record.date), "yyyy-MM-dd"),
        "Clock In": format(new Date(record.start_time), "HH:mm"),
        "Clock Out": record.end_time ? format(new Date(record.end_time), "HH:mm") : "N/A",
        "Breaks (min)": record.lunch_duration || 30,
        "Duration (hours)": calculateDuration(record.start_time, record.end_time, record.lunch_duration || 30).toFixed(2),
        Status: record.end_time ? "Completed" : "Active",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

    const fileName = `attendance_report_${selectedYear}_${selectedMonth}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success("Report downloaded successfully");
  };

  if (adminLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center space-x-6">
              <KeyrusLogo size="sm" />
              <NavLink to="/" className="inline-flex items-center px-1 text-sm font-medium" activeClassName="text-primary border-b-2 border-primary">
                Dashboard
              </NavLink>
              <NavLink to="/admin" className="inline-flex items-center px-1 text-sm font-medium" activeClassName="text-primary border-b-2 border-primary">
                Admin
              </NavLink>
              <NavLink to="/settings" className="inline-flex items-center px-1 text-sm font-medium" activeClassName="text-primary border-b-2 border-primary">
                My Settings
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList>
            <TabsTrigger value="attendance">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Attendance Reports
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="audit">
              <History className="w-4 h-4 mr-2" />
              Audit Trail
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="attendance" className="mt-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    All Employees Attendance Report
                  </CardTitle>
                  <Button 
                    size="sm" 
                    onClick={downloadExcel} 
                    disabled={loading || attendanceData.length === 0}
                    className="h-8"
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Export XLS
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="flex flex-wrap gap-2">
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
                  <Select 
                    value={selectedUsers.length === 0 ? "all" : selectedUsers[0]} 
                    onValueChange={(val) => setSelectedUsers(val === "all" ? [] : [val])}
                  >
                    <SelectTrigger className="w-[200px] h-8 text-sm">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name || profile.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Employee</th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Clock In</th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Clock Out</th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Breaks</th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Duration</th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={6} className="h-24 text-center text-muted-foreground">
                              Loading...
                            </td>
                          </tr>
                        ) : attendanceData.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="h-24 text-center text-muted-foreground">
                              No attendance records found for the selected period.
                            </td>
                          </tr>
                        ) : (
                          attendanceData.map((record) => {
                            const profile = profiles.find((p) => p.id === record.user_id);
                            const duration = calculateDuration(record.start_time, record.end_time, record.lunch_duration || 30);
                            
                            return (
                              <tr key={record.id} className="border-b hover:bg-muted/50">
                                <td className="p-4 align-middle">
                                  {profile?.full_name || profile?.email || "Unknown"}
                                </td>
                                <td className="p-4 align-middle">
                                  {format(new Date(record.date), "MMM dd, yyyy")}
                                </td>
                                <td className="p-4 align-middle">
                                  {format(new Date(record.start_time), "HH:mm")}
                                </td>
                                <td className="p-4 align-middle">
                                  {record.end_time ? format(new Date(record.end_time), "HH:mm") : "-"}
                                </td>
                                <td className="p-4 align-middle">
                                  {record.lunch_duration || 30} min
                                </td>
                                <td className="p-4 align-middle">{duration.toFixed(2)}h</td>
                                <td className="p-4 align-middle">
                                  {record.end_time ? (
                                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-success/10 text-success">
                                      Completed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                                      In Progress
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AuditTrail />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
