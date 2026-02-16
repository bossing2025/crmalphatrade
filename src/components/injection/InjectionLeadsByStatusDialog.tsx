import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface InjectionLead {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  country_code: string;
  status: string;
  scheduled_at?: string | null;
  sent_at?: string | null;
  error_message?: string | null;
  autologin_url?: string | null;
}

interface InjectionLeadsByStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: string;
  leads: InjectionLead[];
}

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/20 text-blue-600",
  sending: "bg-yellow-500/20 text-yellow-600",
  sent: "bg-green-500/20 text-green-600",
  failed: "bg-red-500/20 text-red-600",
  skipped: "bg-orange-500/20 text-orange-600",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

export function InjectionLeadsByStatusDialog({ 
  open, 
  onOpenChange, 
  status, 
  leads 
}: InjectionLeadsByStatusDialogProps) {
  const [search, setSearch] = useState("");

  const filteredLeads = leads.filter((lead) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      lead.email.toLowerCase().includes(searchLower) ||
      lead.firstname.toLowerCase().includes(searchLower) ||
      lead.lastname.toLowerCase().includes(searchLower)
    );
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getTimeColumn = () => {
    if (status === "scheduled") return "Scheduled At";
    if (status === "sent") return "Sent At";
    return null;
  };

  const getTimeValue = (lead: InjectionLead) => {
    if (status === "scheduled" && lead.scheduled_at) {
      return format(new Date(lead.scheduled_at), "MMM d, HH:mm:ss");
    }
    if (status === "sent" && lead.sent_at) {
      return format(new Date(lead.sent_at), "MMM d, HH:mm:ss");
    }
    return "-";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge className={statusColors[status] || ""}>
              {statusLabels[status] || status}
            </Badge>
            <span>Leads ({filteredLeads.length})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Country</TableHead>
                  {getTimeColumn() && <TableHead>{getTimeColumn()}</TableHead>}
                  {status === "failed" && <TableHead>Error</TableHead>}
                  {status === "skipped" && <TableHead>Reason</TableHead>}
                  {status === "sent" && <TableHead>Autologin URL</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lead.firstname} {lead.lastname}</p>
                          <p className="text-sm text-muted-foreground">{lead.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.country_code}</Badge>
                      </TableCell>
                      {getTimeColumn() && (
                        <TableCell className="text-muted-foreground">
                          {getTimeValue(lead)}
                        </TableCell>
                      )}
                      {(status === "failed" || status === "skipped") && (
                        <TableCell>
                          {lead.error_message ? (
                            <span 
                              className="text-xs text-red-500 max-w-[200px] truncate block" 
                              title={lead.error_message}
                            >
                              {lead.error_message}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      {status === "sent" && (
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
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
