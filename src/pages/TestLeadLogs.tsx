import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTestLeadLogs, useDeleteTestLeadLogs } from "@/hooks/useTestLeadLogs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { TestTube2, CheckCircle2, XCircle, Copy, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function TestLeadLogs() {
  const { data: logs, isLoading, error } = useTestLeadLogs();
  const deleteTestLogs = useDeleteTestLeadLogs();
  const { getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  const { isSuperAdmin } = useAuth();

  // Use timezone-aware helpers for initial state
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredLogs = useMemo(() => {
    return logs?.filter((log) => {
      const logDate = new Date(log.created_at);
      const fromStart = getStartOfDay(fromDate);
      const toEnd = getEndOfDay(toDate);
      return logDate >= fromStart && logDate <= toEnd;
    }) || [];
  }, [logs, fromDate, toDate]);

  const allSelected = filteredLogs.length > 0 && filteredLogs.every(log => selectedIds.has(log.id));
  const someSelected = filteredLogs.some(log => selectedIds.has(log.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredLogs.map(log => log.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectChange = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    deleteTestLogs.mutate(idsToDelete, {
      onSuccess: () => {
        setSelectedIds(new Set());
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Test Lead History</h1>
            <p className="text-muted-foreground">
              View all test leads sent to advertisers
            </p>
          </div>
          <div className="flex items-center gap-4">
            {selectedIds.size > 0 && isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Test Logs</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedIds.size} test log{selectedIds.size > 1 ? 's' : ''}? 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <TestTube2 className="h-4 w-4" />
              <span className="text-sm">{filteredLogs.length} test attempts</span>
            </div>
          </div>
        </div>

        {/* Date Filter Bar */}
        <Card className="p-4">
          <DateFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5 text-primary" />
              Test Lead Logs
            </CardTitle>
            <CardDescription>
              History of test leads sent to advertisers for integration testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Failed to load test logs. Please try again.
              </p>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <TestTube2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No test leads sent yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Send a test lead from the Advertisers page
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSuperAdmin && (
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={someSelected ? "indeterminate" : allSelected}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                          />
                        </TableHead>
                      )}
                      <TableHead>Status</TableHead>
                      <TableHead>Advertiser</TableHead>
                      <TableHead>Test Lead</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const advertiser = log.advertisers as any;
                      const testData = log.test_data as any;
                      
                      return (
                        <TableRow 
                          key={log.id}
                          className={selectedIds.has(log.id) ? "bg-muted/50" : ""}
                        >
                          {isSuperAdmin && (
                            <TableCell>
                              <Checkbox 
                                checked={selectedIds.has(log.id)}
                                onCheckedChange={(checked) => handleSelectChange(log.id, !!checked)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            {log.success ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{advertiser?.name || 'Unknown'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-sm">
                                {testData?.firstname} {testData?.lastname}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs text-muted-foreground">
                                  {testData?.email}
                                </p>
                                {testData?.email && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      navigator.clipboard.writeText(testData.email);
                                      toast.success("Email copied to clipboard");
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {testData?.country_code || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[250px]">
                            <div className="flex gap-2">
{/* View Request Button */}
                                              <Dialog>
                                                <DialogTrigger asChild>
                                                  <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="text-xs"
                                                  >
                                                    Request
                                                  </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl max-h-[90vh]">
                                                  <DialogHeader>
                                                    <DialogTitle>Full Request Details</DialogTitle>
                                                    <DialogDescription>
                                                      Complete request sent to {advertiser?.name}
                                                    </DialogDescription>
                                                  </DialogHeader>
                                                  <div className="relative">
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="absolute top-2 right-2 h-8 w-8 z-10"
                                                      onClick={() => {
                                                        const fullRequest = {
                                                          url: log.request_url,
                                                          headers: log.request_headers,
                                                          payload: log.request_payload ? (() => {
                                                            try { return JSON.parse(log.request_payload); } catch { return log.request_payload; }
                                                          })() : null,
                                                          lead_data: testData,
                                                        };
                                                        navigator.clipboard.writeText(JSON.stringify(fullRequest, null, 2));
                                                        toast.success("Full request copied to clipboard");
                                                      }}
                                                    >
                                                      <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <ScrollArea className="max-h-[60vh] border rounded-lg bg-muted/50">
                                                      <div className="p-4 space-y-4 text-sm">
                                                        {/* URL */}
                                                        <div>
                                                          <p className="text-xs text-muted-foreground font-medium mb-1">Target URL</p>
                                                          <code className="text-xs bg-background p-2 rounded block break-all">
                                                            {log.request_url || 'Not recorded'}
                                                          </code>
                                                        </div>
                                                        
                                                        {/* Headers */}
                                                        <div>
                                                          <p className="text-xs text-muted-foreground font-medium mb-1">Headers</p>
                                                          <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">
                                                            {log.request_headers 
                                                              ? JSON.stringify(log.request_headers, null, 2)
                                                              : 'Not recorded'}
                                                          </pre>
                                                        </div>
                                                        
                                                        {/* Payload */}
                                                        <div>
                                                          <p className="text-xs text-muted-foreground font-medium mb-1">Request Payload</p>
                                                          <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">
                                                            {log.request_payload 
                                                              ? (() => {
                                                                  try {
                                                                    return JSON.stringify(JSON.parse(log.request_payload), null, 2);
                                                                  } catch {
                                                                    return log.request_payload;
                                                                  }
                                                                })()
                                                              : 'Not recorded'}
                                                          </pre>
                                                        </div>
                                                        
                                                        {/* Lead Data */}
                                                        <div>
                                                          <p className="text-xs text-muted-foreground font-medium mb-1">Lead Data</p>
                                                          <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">
                                                            {JSON.stringify(testData, null, 2)}
                                                          </pre>
                                                        </div>
                                                      </div>
                                                    </ScrollArea>
                                                  </div>
                                                </DialogContent>
                                              </Dialog>
                              
                              {/* View Response Button */}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant={log.success ? "outline" : "destructive"}
                                    size="sm"
                                    className="text-xs"
                                  >
                                    Response
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>Advertiser Response</DialogTitle>
                                    <DialogDescription>
                                      Response from {advertiser?.name}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="relative">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="absolute top-2 right-2 h-8 w-8 z-10"
                                      onClick={() => {
                                        const content = log.response ? 
                                          (() => {
                                            try {
                                              return JSON.stringify(JSON.parse(log.response), null, 2);
                                            } catch {
                                              return log.response;
                                            }
                                          })() 
                                          : '';
                                        navigator.clipboard.writeText(content);
                                        toast.success("Response copied to clipboard");
                                      }}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <ScrollArea className="max-h-[400px] border rounded-lg bg-muted/50">
                                      <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                                        {log.response ? 
                                          (() => {
                                            try {
                                              return JSON.stringify(JSON.parse(log.response), null, 2);
                                            } catch {
                                              return log.response;
                                            }
                                          })() 
                                          : 'No response'
                                        }
                                      </pre>
                                    </ScrollArea>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(log.created_at), "MMM d, HH:mm")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
