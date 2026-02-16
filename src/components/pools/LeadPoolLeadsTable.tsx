import { useState } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, EyeOff, CheckCircle, XCircle, Clock, Send, AlertCircle } from "lucide-react";
import type { LeadPoolLead, InjectionStatus } from "@/hooks/useLeadPools";
import { format } from "date-fns";
import { useHideLeadPoolLead } from "@/hooks/useLeadPools";

interface LeadPoolLeadsTableProps {
  leads: LeadPoolLead[];
  poolId: string;
}

function getStatusBadge(status: string, onClick?: () => void) {
  const badge = (() => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'failed':
        return (
          <Badge 
            variant="destructive" 
            className={onClick ? "cursor-pointer hover:bg-destructive/90" : ""}
            onClick={onClick}
          >
            <XCircle className="h-3 w-3 mr-1" />Failed
          </Badge>
        );
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'sending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Send className="h-3 w-3 mr-1" />Sending</Badge>;
      case 'skipped':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Skipped</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  })();
  
  return badge;
}

interface InjectionStatusCellProps {
  statuses?: InjectionStatus[];
  onViewError: (injection: InjectionStatus) => void;
}

function InjectionStatusCell({ statuses, onViewError }: InjectionStatusCellProps) {
  if (!statuses || statuses.length === 0) {
    return <span className="text-muted-foreground text-sm">Not injected</span>;
  }

  // Show the most recent/relevant injection
  const latestInjection = statuses[0];
  const hasMultiple = statuses.length > 1;

  const handleFailedClick = () => {
    if (latestInjection.status === 'failed') {
      onViewError(latestInjection);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {getStatusBadge(
            latestInjection.status, 
            latestInjection.status === 'failed' ? handleFailedClick : undefined
          )}
          {hasMultiple && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  +{statuses.length - 1} more
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  {statuses.slice(1).map((s, i) => (
                    <div key={i} className="text-xs">
                      <p className="font-medium">{s.advertiser_name}</p>
                      <p className="text-muted-foreground">
                        {s.status} {s.sent_at && `• ${format(new Date(s.sent_at), 'MMM d, HH:mm')}`}
                      </p>
                      {s.status === 'failed' && s.error_message && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-xs text-destructive"
                          onClick={() => onViewError(s)}
                        >
                          View Error
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function LeadPoolLeadsTable({ leads, poolId }: LeadPoolLeadsTableProps) {
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; injection: InjectionStatus | null }>({
    open: false,
    injection: null,
  });
  const hideLead = useHideLeadPoolLead();

  // Get unique countries
  const countries = [...new Set(leads.map(l => l.country_code))].sort();

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !search ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      lead.firstname.toLowerCase().includes(search.toLowerCase()) ||
      lead.lastname.toLowerCase().includes(search.toLowerCase());

    const matchesCountry = countryFilter === "all" || lead.country_code === countryFilter;

    // Status filter
    let matchesStatus = true;
    if (statusFilter !== "all") {
      const hasStatus = lead.injection_statuses?.some(s => s.status === statusFilter);
      const isNotInjected = !lead.injection_statuses || lead.injection_statuses.length === 0;
      
      if (statusFilter === "not_injected") {
        matchesStatus = isNotInjected;
      } else {
        matchesStatus = hasStatus || false;
      }
    }

    return matchesSearch && matchesCountry && matchesStatus;
  });

  const handleViewError = (injection: InjectionStatus) => {
    setErrorDialog({ open: true, injection });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map(code => (
              <SelectItem key={code} value={code}>{code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_injected">Not Injected</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Advertiser</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent At</TableHead>
              <TableHead>Source Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => {
                const latestInjection = lead.injection_statuses?.[0];
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.firstname} {lead.lastname}</p>
                        <p className="text-sm text-muted-foreground">{lead.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{lead.mobile}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.country_code}</Badge>
                    </TableCell>
                    <TableCell>
                      {latestInjection ? (
                        <div>
                          <p className="font-medium text-sm">{latestInjection.advertiser_name}</p>
                          <p className="text-xs text-muted-foreground">{latestInjection.injection_name}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <InjectionStatusCell statuses={lead.injection_statuses} onViewError={handleViewError} />
                    </TableCell>
                    <TableCell>
                      {latestInjection?.sent_at ? (
                        <span className="text-sm">
                          {format(new Date(latestInjection.sent_at), 'MMM d, HH:mm')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.source_date
                        ? format(new Date(lead.source_date), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-orange-600"
                        onClick={() => hideLead.mutate({ leadId: lead.id, poolId })}
                        disabled={hideLead.isPending}
                        title="Hide lead"
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredLeads.length} of {leads.length} leads
      </p>

      {/* Error Details Dialog */}
      <Dialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog({ open, injection: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Injection Failed
            </DialogTitle>
            <DialogDescription>
              Error details for {errorDialog.injection?.advertiser_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Advertiser</p>
                <p>{errorDialog.injection?.advertiser_name || '-'}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Injection</p>
                <p>{errorDialog.injection?.injection_name || '-'}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Sent At</p>
                <p>
                  {errorDialog.injection?.sent_at 
                    ? format(new Date(errorDialog.injection.sent_at), 'MMM d, yyyy HH:mm:ss')
                    : '-'}
                </p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Status</p>
                <Badge variant="destructive">Failed</Badge>
              </div>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-2">Error Message</p>
              <div className="bg-muted/50 rounded-md p-3 text-sm font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                {errorDialog.injection?.error_message || 'No error message available'}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}