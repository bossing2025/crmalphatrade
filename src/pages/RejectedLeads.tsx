import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRejectedLeads, useDeleteRejectedLeads } from "@/hooks/useRejectedLeads";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { AlertCircle, XCircle, Trash2, Copy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";

export default function RejectedLeads() {
  const { data: rejectedLeads, isLoading, error } = useRejectedLeads();
  const deleteRejectedLeads = useDeleteRejectedLeads();
  const { getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  const { canDeleteLeads } = useCurrentUserPermissions();
  
  // Use timezone-aware helpers for initial state
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredLeads = useMemo(() => {
    return rejectedLeads?.filter((rejection) => {
      const rejectedDate = new Date(rejection.created_at);
      const fromStart = getStartOfDay(fromDate);
      const toEnd = getEndOfDay(toDate);
      return rejectedDate >= fromStart && rejectedDate <= toEnd;
    }) || [];
  }, [rejectedLeads, fromDate, toDate]);

  const allSelected = filteredLeads.length > 0 && filteredLeads.every(lead => selectedIds.has(lead.id));
  const someSelected = filteredLeads.some(lead => selectedIds.has(lead.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredLeads.map(lead => lead.id)));
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
    const itemsToDelete = filteredLeads
      .filter(lead => selectedIds.has(lead.id))
      .map(lead => ({
        id: lead.id,
        source: lead.source,
        lead_id: lead.lead_id,
      }));
    
    deleteRejectedLeads.mutate(itemsToDelete, {
      onSuccess: () => {
        setSelectedIds(new Set());
      },
    });
  };

  const parseReason = (reason: string | null) => {
    if (!reason) return "Unknown reason";
    try {
      const parsed = JSON.parse(reason);
      if (parsed.errors) {
        if (typeof parsed.errors === 'object' && !Array.isArray(parsed.errors)) {
          return Object.entries(parsed.errors)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('; ');
        }
        if (Array.isArray(parsed.errors)) {
          return parsed.errors.join('; ');
        }
      }
      if (parsed.message) return parsed.message;
      return reason;
    } catch {
      return reason;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Rejected Leads</h1>
            <p className="text-muted-foreground">
              View leads that failed distribution to advertisers
            </p>
          </div>
          <div className="flex items-center gap-4">
            {selectedIds.size > 0 && canDeleteLeads && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Rejected Leads</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedIds.size} rejected lead{selectedIds.size > 1 ? 's' : ''}? 
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
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{filteredLeads.length} rejected leads</span>
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
              <XCircle className="h-5 w-5 text-destructive" />
              Failed Distributions
            </CardTitle>
            <CardDescription>
              Leads rejected by advertisers with error details
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
                Failed to load rejected leads. Please try again.
              </p>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <XCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No rejected leads found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  All leads have been successfully distributed
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canDeleteLeads && (
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={someSelected ? "indeterminate" : allSelected}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                          />
                        </TableHead>
                      )}
                      <TableHead>Lead</TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Advertiser</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Rejection Reason</TableHead>
                      <TableHead>Rejected At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((rejection) => {
                      const lead = rejection.leads as any;
                      const advertiser = rejection.advertisers as any;
                      
                      return (
                        <TableRow 
                          key={rejection.id}
                          className={selectedIds.has(rejection.id) ? "bg-muted/50" : ""}
                        >
                          {canDeleteLeads && (
                            <TableCell>
                              <Checkbox 
                                checked={selectedIds.has(rejection.id)}
                                onCheckedChange={(checked) => handleSelectChange(rejection.id, !!checked)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {lead?.firstname} {lead?.lastname}
                              </p>
                              <div className="flex items-center gap-1">
                                <p className="text-xs text-muted-foreground">
                                  {lead?.email}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    navigator.clipboard.writeText(lead?.email || '');
                                    toast.success('Email copied');
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {lead?.request_id?.substring(0, 8) || '-'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {advertiser?.name || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {lead?.country_code || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                                >
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Rejection Details</DialogTitle>
                                  <DialogDescription>
                                    Full error response from {advertiser?.name}
                                  </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[400px] border rounded-lg bg-muted/50">
                                  <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                                    {rejection.reason ? 
                                      (() => {
                                        try {
                                          return JSON.stringify(JSON.parse(rejection.reason), null, 2);
                                        } catch {
                                          return rejection.reason;
                                        }
                                      })() 
                                      : 'No details available'
                                    }
                                  </pre>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                          <TableCell>
                            {format(new Date(rejection.created_at), "MMM d, yyyy HH:mm")}
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
