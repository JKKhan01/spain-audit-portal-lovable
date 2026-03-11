import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { History, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  created_at: string;
}

type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: unknown;
  new_data: unknown;
  changed_fields: string[] | null;
  user_id: string | null;
  created_at: string;
};

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

export const AuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;

  const tables = [
    { value: "all", label: "All Tables" },
    { value: "attendance", label: "Attendance" },
    { value: "profiles", label: "Profiles" },
    { value: "working_patterns", label: "Working Patterns" },
    { value: "user_roles", label: "User Roles" },
  ];

  const actions = [
    { value: "all", label: "All Actions" },
    { value: "INSERT", label: "Insert" },
    { value: "UPDATE", label: "Update" },
    { value: "DELETE", label: "Delete" },
  ];

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    setPage(0);
    fetchAuditLogs(0);
  }, [selectedUser, selectedTable, selectedAction, dateFrom, dateTo]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    setProfiles(data || []);
  };

  const fetchAuditLogs = async (pageNum: number) => {
    setLoading(true);

    let query = supabase
      .from("audit_logs")
      .select("*")
      .gte("created_at", startOfDay(new Date(dateFrom)).toISOString())
      .lte("created_at", endOfDay(new Date(dateTo)).toISOString())
      .order("created_at", { ascending: false })
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

    if (selectedUser !== "all") {
      query = query.eq("user_id", selectedUser);
    }

    if (selectedTable !== "all") {
      query = query.eq("table_name", selectedTable);
    }

    if (selectedAction !== "all") {
      query = query.eq("action", selectedAction);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error("Error fetching audit logs:", error);
      toast.error("Failed to load audit logs");
      return;
    }

    // Transform the data to match our interface
    const transformedData: AuditLog[] = (data || []).map((row: AuditLogRow) => ({
      ...row,
      old_data: row.old_data as Record<string, unknown> | null,
      new_data: row.new_data as Record<string, unknown> | null,
    }));

    setAuditLogs(transformedData);
    setHasMore((data?.length || 0) === pageSize);
  };

  const handleNextPage = () => {
    const newPage = page + 1;
    setPage(newPage);
    fetchAuditLogs(newPage);
  };

  const handlePrevPage = () => {
    const newPage = Math.max(0, page - 1);
    setPage(newPage);
    fetchAuditLogs(newPage);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const profile = profiles.find((p) => p.id === userId);
    return profile?.full_name || profile?.email || "Unknown";
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "INSERT":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatJsonDiff = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null, changedFields: string[] | null) => {
    if (!changedFields || changedFields.length === 0) {
      return null;
    }

    return changedFields.map((field) => ({
      field,
      oldValue: oldData ? oldData[field] : null,
      newValue: newData ? newData[field] : null,
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4 text-primary" />
          Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[140px] h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[140px] h-8 text-sm"
            />
          </div>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || profile.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="All Tables" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.value} value={table.value}>
                  {table.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger className="w-[130px] h-8 text-sm">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((action) => (
                <SelectItem key={action.value} value={action.value}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Changed Fields</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No audit logs found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>{getUserName(log.user_id)}</TableCell>
                    <TableCell className="capitalize">{log.table_name.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.changed_fields && log.changed_fields.length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {log.changed_fields.slice(0, 3).join(", ")}
                          {log.changed_fields.length > 3 && ` +${log.changed_fields.length - 3} more`}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Audit Log Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Timestamp:</span>
                                <p className="text-muted-foreground">
                                  {format(new Date(log.created_at), "PPpp")}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">User:</span>
                                <p className="text-muted-foreground">{getUserName(log.user_id)}</p>
                              </div>
                              <div>
                                <span className="font-medium">Table:</span>
                                <p className="text-muted-foreground capitalize">{log.table_name}</p>
                              </div>
                              <div>
                                <span className="font-medium">Action:</span>
                                <p>
                                  <Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">Record ID:</span>
                                <p className="text-muted-foreground font-mono text-xs">{log.record_id}</p>
                              </div>
                            </div>

                            {log.action === "UPDATE" && log.changed_fields && log.changed_fields.length > 0 && (
                              <div>
                                <span className="font-medium text-sm">Changes:</span>
                                <ScrollArea className="h-[200px] mt-2 rounded-md border p-4">
                                  <div className="space-y-3">
                                    {formatJsonDiff(log.old_data, log.new_data, log.changed_fields)?.map((change) => (
                                      <div key={change.field} className="text-sm">
                                        <span className="font-medium">{change.field}:</span>
                                        <div className="ml-4 space-y-1">
                                          <p className="text-destructive">
                                            - {JSON.stringify(change.oldValue)}
                                          </p>
                                          <p className="text-success">
                                            + {JSON.stringify(change.newValue)}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}

                            {log.action === "INSERT" && log.new_data && (
                              <div>
                                <span className="font-medium text-sm">New Data:</span>
                                <ScrollArea className="h-[200px] mt-2 rounded-md border p-4">
                                  <pre className="text-xs font-mono">
                                    {JSON.stringify(log.new_data, null, 2)}
                                  </pre>
                                </ScrollArea>
                              </div>
                            )}

                            {log.action === "DELETE" && log.old_data && (
                              <div>
                                <span className="font-medium text-sm">Deleted Data:</span>
                                <ScrollArea className="h-[200px] mt-2 rounded-md border p-4">
                                  <pre className="text-xs font-mono text-destructive">
                                    {JSON.stringify(log.old_data, null, 2)}
                                  </pre>
                                </ScrollArea>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {auditLogs.length} records (page {page + 1})
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
