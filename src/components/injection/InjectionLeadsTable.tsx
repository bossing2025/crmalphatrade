import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, ExternalLink, Search, Upload, Users, Clock, Timer } from "lucide-react";
import { toast } from "sonner";
import type { InjectionLead } from "@/hooks/useInjections";
import { formatDistanceToNow, isPast, differenceInSeconds } from "date-fns";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCRMSettings } from "@/hooks/useCRMSettings";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/20 text-blue-600",
  sending: "bg-yellow-500/20 text-yellow-600",
  sent: "bg-green-500/20 text-green-600",
  failed: "bg-red-500/20 text-red-600",
  skipped: "bg-orange-500/20 text-orange-600",
};

interface InjectionLeadsTableProps {
  leads: InjectionLead[];
  effectiveTarget?: number;
  sentCount?: number;
}

export function InjectionLeadsTable({ leads, effectiveTarget, sentCount }: InjectionLeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: affiliates = [] } = useAffiliates();
  const { formatDate, timezone } = useCRMSettings();

  const formatTime = (date: Date | string, timeFormat: string = "HH:mm:ss") => {
    return `${formatDate(date, timeFormat)} ${timezone}`;
  };

  // Fetch source info for pool leads
  const poolLeadIds = leads.map(l => l.pool_lead_id).filter(Boolean) as string[];
  const { data: poolLeadsSource = [] } = useQuery({
    queryKey: ['pool-leads-source', poolLeadIds],
    queryFn: async () => {
      if (poolLeadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('lead_pool_leads')
        .select('id, source_affiliate_id')
        .in('id', poolLeadIds);
      if (error) throw error;
      return data;
    },
    enabled: poolLeadIds.length > 0,
  });

  const getSourceInfo = (poolLeadId: string | null) => {
    if (!poolLeadId) return { type: 'import', name: 'CSV Import' };
    const poolLead = poolLeadsSource.find(p => p.id === poolLeadId);
    if (!poolLead || !poolLead.source_affiliate_id) {
      return { type: 'import', name: 'CSV Import' };
    }
    const affiliate = affiliates.find(a => a.id === poolLead.source_affiliate_id);
    return { type: 'affiliate', name: affiliate?.name || 'Unknown Affiliate' };
  };

  // Sort leads: scheduled first (by scheduled_at), then pending, then others
  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      // Scheduled leads come first, sorted by scheduled_at
      if (a.status === 'scheduled' && b.status === 'scheduled') {
        return new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime();
      }
      if (a.status === 'scheduled') return -1;
      if (b.status === 'scheduled') return 1;
      
      // Then pending leads
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      
      // Then sending
      if (a.status === 'sending' && b.status !== 'sending') return -1;
      if (b.status === 'sending' && a.status !== 'sending') return 1;
      
      // Finally by created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [leads]);

  const filteredLeads = sortedLeads.filter((lead) => {
    const matchesSearch =
      !search ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      lead.firstname.toLowerCase().includes(search.toLowerCase()) ||
      lead.lastname.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Find the next lead to be sent (first scheduled lead)
  const nextScheduledLead = sortedLeads.find(l => l.status === 'scheduled' && l.scheduled_at);

  // Cap-aware queue (only pending/scheduled/sending, limited to remaining cap)
  const maxInQueue = useMemo(() => {
    if (effectiveTarget === undefined || sentCount === undefined) return Infinity;
    return Math.max(0, effectiveTarget - sentCount);
  }, [effectiveTarget, sentCount]);

  const cappedQueueLeads = useMemo(() => {
    const queue = sortedLeads.filter(
      (l) => l.status === 'scheduled' || l.status === 'sending' || l.status === 'pending'
    );
    return queue.slice(0, maxInQueue);
  }, [sortedLeads, maxInQueue]);

  const renderScheduleInfo = (lead: InjectionLead, index: number) => {
    if (lead.status === 'pending') {
      const queueIndex = cappedQueueLeads.findIndex((l) => l.id === lead.id);

      // If this lead is beyond the cap, don't show queue position
      if (queueIndex === -1) {
        return (
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">Beyond cap</span>
          </div>
        );
      }
      
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs">Queue #{queueIndex + 1}</span>
        </div>
      );
    }
    
    if (lead.status === 'scheduled' && lead.scheduled_at) {
      const scheduledDate = new Date(lead.scheduled_at);
      const isOverdue = isPast(scheduledDate);
      const secondsUntil = differenceInSeconds(scheduledDate, new Date());
      const isNext = nextScheduledLead?.id === lead.id;
      const secondsOverdue = differenceInSeconds(new Date(), scheduledDate);
      
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Timer className={`h-3.5 w-3.5 ${isOverdue ? 'text-yellow-500' : isNext ? 'text-green-500 animate-pulse' : 'text-blue-500'}`} />
            <span className="text-sm font-medium">
              {formatDate(scheduledDate, 'HH:mm:ss')}
            </span>
            {isNext && !isOverdue && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                NEXT
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                READY
              </Badge>
            )}
          </div>
          <div className={`text-xs ${isOverdue ? 'text-yellow-600' : 'text-muted-foreground'}`}>
            {isOverdue ? (
              secondsOverdue > 300 ? 'Waiting for processor...' : 'Ready to send'
            ) : secondsUntil < 60 ? (
              `in ${secondsUntil}s`
            ) : (
              formatDistanceToNow(scheduledDate, { addSuffix: true })
            )}
          </div>
        </div>
      );
    }
    
    if (lead.status === 'sending') {
      return (
        <div className="flex items-center gap-1.5 text-yellow-600">
          <Timer className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs font-medium">Sending now...</span>
        </div>
      );
    }
    
    return <span className="text-muted-foreground">-</span>;
  };

  // Calculate queue stats - limit to effective target (cap)
  const queueStats = useMemo(() => {
    const scheduled = cappedQueueLeads.filter((l) => l.status === 'scheduled').length;
    const pending = cappedQueueLeads.filter((l) => l.status === 'pending').length;
    const sending = cappedQueueLeads.filter((l) => l.status === 'sending').length;
    const waiting = cappedQueueLeads.length;

    // Get first and last scheduled times (within cap)
    const scheduledLeads = cappedQueueLeads.filter(l => l.status === 'scheduled' && l.scheduled_at);
    const sortedScheduled = scheduledLeads.sort((a, b) => 
      new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
    );
    const firstScheduled = sortedScheduled[0]?.scheduled_at;
    const lastScheduled = sortedScheduled[sortedScheduled.length - 1]?.scheduled_at;
    
    return { scheduled, pending, sending, waiting, firstScheduled, lastScheduled };
  }, [cappedQueueLeads]);

  const handleQueueBadgeClick = (status: string) => {
    setStatusFilter(status);
  };

  return (
    <div className="space-y-4">
      {/* Queue Overview */}
      {queueStats.waiting > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Queue:</span>
          </div>
          {queueStats.sending > 0 && (
            <Badge 
              variant="outline" 
              className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 cursor-pointer hover:bg-yellow-500/20 transition-colors"
              onClick={() => handleQueueBadgeClick('sending')}
            >
              {queueStats.sending} sending
            </Badge>
          )}
          {queueStats.scheduled > 0 && (
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className="bg-blue-500/10 text-blue-600 border-blue-500/30 cursor-pointer hover:bg-blue-500/20 transition-colors"
                onClick={() => handleQueueBadgeClick('scheduled')}
              >
                {queueStats.scheduled} scheduled
              </Badge>
              {queueStats.firstScheduled && queueStats.lastScheduled && (
                <span className="text-xs text-muted-foreground">
                  ({formatDate(new Date(queueStats.firstScheduled), 'HH:mm')} - {formatDate(new Date(queueStats.lastScheduled), 'HH:mm')})
                </span>
              )}
            </div>
          )}
          {queueStats.pending > 0 && (
            <Badge 
              variant="outline" 
              className="bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleQueueBadgeClick('pending')}
            >
              {queueStats.pending} pending
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs ml-auto"
              onClick={() => setStatusFilter('all')}
            >
              Clear filter
            </Button>
          )}
          {statusFilter === 'all' && nextScheduledLead?.scheduled_at && (
            <span className="text-xs text-muted-foreground ml-auto">
              Next send: {formatTime(new Date(nextScheduledLead.scheduled_at), 'HH:mm:ss')}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Schedule</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sending To</TableHead>
              <TableHead>Autologin URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead, index) => {
                const sourceInfo = getSourceInfo(lead.pool_lead_id);
                return (
                  <TableRow key={lead.id} className={lead.status === 'sending' ? 'bg-yellow-500/5' : ''}>
                    <TableCell>
                      {renderScheduleInfo(lead, index)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.firstname} {lead.lastname}</p>
                        <p className="text-sm text-muted-foreground">{lead.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.country_code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {sourceInfo.type === 'import' ? (
                          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="text-sm">{sourceInfo.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[lead.status] || ""}>
                        {lead.status}
                      </Badge>
                      {lead.error_message && (
                        <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={lead.error_message}>
                          {lead.error_message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.advertiser?.name ? (
                        <span className="font-medium">{lead.advertiser.name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.autologin_url ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(lead.autologin_url!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                          >
                            <a href={lead.autologin_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}