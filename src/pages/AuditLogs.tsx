import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditLogs, useAuditLogActions, useAuditLogTables } from "@/hooks/useAuditLogs";
import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Search, FileText, User, Clock, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AuditLogs() {
  const [action, setAction] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLogs({
    action: action || undefined,
    tableName: tableName || undefined,
    userEmail: userEmail || undefined,
    page,
    pageSize: 50,
  });

  const { data: actions } = useAuditLogActions();
  const { data: tables } = useAuditLogTables();

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('insert')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (action.includes('delete') || action.includes('remove')) return 'bg-destructive/20 text-destructive';
    if (action.includes('login') || action.includes('auth')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    return 'bg-muted text-muted-foreground';
  };

  const formatJson = (data: Record<string, unknown> | null) => {
    if (!data) return 'N/A';
    return JSON.stringify(data, null, 2);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">Track all user actions and system changes</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by user email..."
                    value={userEmail}
                    onChange={(e) => {
                      setUserEmail(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select
                value={action}
                onValueChange={(value) => {
                  setAction(value === "all" ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions?.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={tableName}
                onValueChange={(value) => {
                  setTableName(value === "all" ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {tables?.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(action || tableName || userEmail) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setAction("");
                    setTableName("");
                    setUserEmail("");
                    setPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Action Types</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{actions?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tables Tracked</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tables?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Page</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{page} / {data?.totalPages || 1}</div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm truncate max-w-[150px]" title={log.user_email || undefined}>
                                {log.user_email || 'System'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionColor(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.table_name ? (
                              <Badge variant="outline">{log.table_name}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={log.changes_summary || undefined}>
                            {log.changes_summary || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.ip_address || '-'}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Audit Log Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Action:</span>
                                      <Badge className={`ml-2 ${getActionColor(log.action)}`}>{log.action}</Badge>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Table:</span>
                                      <span className="ml-2">{log.table_name || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">User:</span>
                                      <span className="ml-2">{log.user_email || 'System'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Record ID:</span>
                                      <span className="ml-2 font-mono text-xs">{log.record_id || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">IP:</span>
                                      <span className="ml-2">{log.ip_address || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Time:</span>
                                      <span className="ml-2">{format(new Date(log.created_at), "PPpp")}</span>
                                    </div>
                                  </div>

                                  {log.changes_summary && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">Summary:</span>
                                      <p className="mt-1 text-sm">{log.changes_summary}</p>
                                    </div>
                                  )}

                                  {log.old_data && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">Previous Data:</span>
                                      <ScrollArea className="h-32 mt-1">
                                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                          {formatJson(log.old_data)}
                                        </pre>
                                      </ScrollArea>
                                    </div>
                                  )}

                                  {log.new_data && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">New Data:</span>
                                      <ScrollArea className="h-32 mt-1">
                                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                          {formatJson(log.new_data)}
                                        </pre>
                                      </ScrollArea>
                                    </div>
                                  )}

                                  {log.user_agent && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">User Agent:</span>
                                      <p className="mt-1 text-xs text-muted-foreground truncate">{log.user_agent}</p>
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

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.total)} of {data.total} logs
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                        disabled={page >= data.totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
