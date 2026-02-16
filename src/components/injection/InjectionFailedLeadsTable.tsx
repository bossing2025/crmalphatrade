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
import { Copy, Search, Upload, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { InjectionLead } from "@/hooks/useInjections";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCRMSettings } from "@/hooks/useCRMSettings";

interface InjectionFailedLeadsTableProps {
  leads: InjectionLead[];
}

export function InjectionFailedLeadsTable({ leads }: InjectionFailedLeadsTableProps) {
  const [search, setSearch] = useState("");
  const { data: affiliates = [] } = useAffiliates();
  const { formatDate, timezone } = useCRMSettings();

  // Filter to only failed leads
  const failedLeads = leads.filter(lead => lead.status === 'failed');

  // Fetch source info for pool leads
  const poolLeadIds = failedLeads.map(l => l.pool_lead_id).filter(Boolean) as string[];
  const { data: poolLeadsSource = [] } = useQuery({
    queryKey: ['pool-leads-source-failed', poolLeadIds],
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

  const filteredLeads = failedLeads.filter((lead) => {
    const matchesSearch =
      !search ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      lead.firstname.toLowerCase().includes(search.toLowerCase()) ||
      lead.lastname.toLowerCase().includes(search.toLowerCase()) ||
      (lead.error_message?.toLowerCase().includes(search.toLowerCase()));

    return matchesSearch;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (failedLeads.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
          <AlertTriangle className="h-8 w-8 text-green-600" />
        </div>
        <p className="text-lg font-medium text-muted-foreground">No failed leads</p>
        <p className="text-sm text-muted-foreground mt-1">
          All leads were sent successfully or are still pending
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="destructive" className="h-8 px-3">
          {failedLeads.length} failed
        </Badge>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Failed At</TableHead>
              <TableHead>Response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No matching failed leads found
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => {
                const sourceInfo = getSourceInfo(lead.pool_lead_id);
                return (
                  <TableRow key={lead.id} className="bg-destructive/5">
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.firstname} {lead.lastname}</p>
                        <p className="text-sm text-muted-foreground">{lead.email}</p>
                        <p className="text-xs text-muted-foreground">{lead.mobile}</p>
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
                      {lead.sent_at
                        ? `${formatDate(new Date(lead.sent_at), 'MMM d, HH:mm:ss')} ${timezone}`
                        : lead.scheduled_at 
                          ? `${formatDate(new Date(lead.scheduled_at), 'MMM d, HH:mm:ss')} ${timezone}`
                          : '-'}
                    </TableCell>
                    <TableCell>
                      {lead.response ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => copyToClipboard(lead.response!)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Response
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
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
