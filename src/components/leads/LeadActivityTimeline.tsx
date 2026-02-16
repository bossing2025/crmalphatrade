import { useQuery } from "@tanstack/react-query";
import { dbProxy } from "@/lib/dbProxy";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  RefreshCw, 
  DollarSign,
  AlertTriangle,
  History,
  ArrowRight
} from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";

interface LeadActivityTimelineProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimelineEvent {
  id: string;
  type: "status_change" | "distribution" | "callback" | "ftd";
  timestamp: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  status?: "success" | "error" | "pending" | "info";
}

export function LeadActivityTimeline({ leadId, open, onOpenChange }: LeadActivityTimelineProps) {
  const { formatDate } = useCRMSettings();

  const { data: lead } = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      return dbProxy<any>({
        table: "leads",
        operation: "select_single",
        select: "*, affiliates(name)",
        filters: { id: leadId },
      });
    },
    enabled: !!leadId && open,
  });

  const { data: statusHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["lead-status-history", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      return dbProxy<any[]>({
        table: "lead_status_history",
        operation: "select",
        filters: { lead_id: leadId },
        order: { column: "created_at", ascending: false },
      }) ?? [];
    },
    enabled: !!leadId && open,
  });

  const { data: distributions, isLoading: loadingDist } = useQuery({
    queryKey: ["lead-distributions", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      return dbProxy<any[]>({
        table: "lead_distributions",
        operation: "select",
        select: "*, advertisers(name)",
        filters: { lead_id: leadId },
        order: { column: "created_at", ascending: false },
      }) ?? [];
    },
    enabled: !!leadId && open,
  });

  const { data: callbacks, isLoading: loadingCallbacks } = useQuery({
    queryKey: ["lead-callbacks", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      return dbProxy<any[]>({
        table: "callback_logs",
        operation: "select",
        filters: { lead_id: leadId },
        order: { column: "created_at", ascending: false },
      }) ?? [];
    },
    enabled: !!leadId && open,
  });

  const timeline: TimelineEvent[] = [];

  statusHistory?.forEach((sh) => {
    const fieldLabel = sh.field_name === 'status' ? 'Lead Status' 
      : sh.field_name === 'sale_status' ? 'Sale Status'
      : sh.field_name === 'is_ftd' ? 'FTD Status'
      : sh.field_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    
    timeline.push({
      id: `sh-${sh.id}`,
      type: "status_change",
      timestamp: sh.created_at,
      title: `${fieldLabel} Updated`,
      description: `${sh.old_value || "(none)"} → ${sh.new_value || "(none)"}`,
      metadata: { 
        source: sh.change_source, 
        reason: sh.change_reason,
        changedBy: sh.changed_by 
      },
      status: sh.field_name === 'status' || sh.field_name === 'sale_status' ? "success" : "info",
    });
  });

  distributions?.forEach((dist) => {
    timeline.push({
      id: `dist-${dist.id}`,
      type: "distribution",
      timestamp: dist.created_at,
      title: `Sent to ${(dist as any).advertisers?.name || "Unknown"}`,
      description: dist.status === "sent" 
        ? `External ID: ${dist.external_lead_id || "-"}`
        : dist.response?.slice(0, 100),
      metadata: { autologin: dist.autologin_url },
      status: dist.status === "sent" ? "success" : dist.status === "failed" ? "error" : "pending",
    });
  });

  callbacks?.forEach((cb) => {
    timeline.push({
      id: `cb-${cb.id}`,
      type: "callback",
      timestamp: cb.created_at,
      title: `Callback: ${cb.callback_type}`,
      description: cb.processing_status === "processed" 
        ? `Changes: ${JSON.stringify(cb.changes_applied || {})}`
        : cb.processing_error,
      metadata: { advertiser: cb.advertiser_name },
      status: cb.processing_status === "processed" ? "success" : "error",
    });
  });

  if (lead?.is_ftd && lead?.ftd_date) {
    timeline.push({
      id: "ftd",
      type: "ftd",
      timestamp: lead.ftd_date,
      title: "FTD Confirmed",
      description: lead.ftd_released ? "Released to affiliate" : "Pending release",
      status: "success",
    });
  }

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const isLoading = loadingHistory || loadingDist || loadingCallbacks;

  const getIcon = (event: TimelineEvent) => {
    switch (event.type) {
      case "distribution":
        return event.status === "success" ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : event.status === "error" ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : (
          <Clock className="h-4 w-4 text-yellow-500" />
        );
      case "callback":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "ftd":
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case "status_change":
        return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (event: TimelineEvent) => {
    if (!event.status) return null;
    const variants: Record<string, string> = {
      success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return (
      <Badge className={`text-xs ${variants[event.status]}`}>
        {event.type}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Lead Activity Timeline
          </DialogTitle>
        </DialogHeader>

        {lead && (
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{lead.firstname} {lead.lastname}</p>
                <p className="text-sm text-muted-foreground truncate">{lead.email}</p>
              </div>
              <div className="text-right flex flex-wrap justify-end gap-2">
                <Badge variant="outline">{lead.country_code}</Badge>
                <Badge variant="outline">Status: {lead.status}</Badge>
                {lead.sale_status ? (
                  <Badge variant="outline">Sales: {lead.sale_status}</Badge>
                ) : (
                  <Badge variant="outline">Sales: -</Badge>
                )}
                {lead.is_ftd && (
                  <Badge variant="secondary">FTD</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No activity recorded for this lead</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-4">
                {timeline.map((event) => (
                  <div key={event.id} className="relative pl-10">
                    <div className="absolute left-2 top-1 bg-background p-1 rounded-full border">
                      {getIcon(event)}
                    </div>
                    
                    <div className="bg-card border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{event.title}</span>
                            {getStatusBadge(event)}
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate" title={event.description}>
                              {event.description}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(event.timestamp, "MMM d, HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
