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
import { Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import type { InjectionPoolLead } from "@/hooks/useInjectionPools";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/20 text-blue-600",
  sending: "bg-yellow-500/20 text-yellow-600",
  sent: "bg-green-500/20 text-green-600",
  failed: "bg-red-500/20 text-red-600",
  skipped: "bg-orange-500/20 text-orange-600",
};

interface InjectionPoolLeadsTableProps {
  leads: InjectionPoolLead[];
}

export function InjectionPoolLeadsTable({ leads }: InjectionPoolLeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredLeads = leads.filter((lead) => {
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

  return (
    <div className="space-y-4">
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
              <TableHead>Lead</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Sending To</TableHead>
              <TableHead>Autologin URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                    {lead.scheduled_at
                      ? format(new Date(lead.scheduled_at), 'MMM d, HH:mm:ss')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">-</span>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
