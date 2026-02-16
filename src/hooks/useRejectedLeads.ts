import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRejectedLeads() {
  return useQuery({
    queryKey: ['rejected-leads'],
    queryFn: async () => {
      // Fetch leads with status 'rejected' along with their failed distributions
      const { data: rejectedStatusLeads, error: rejectedError } = await supabase
        .from('leads')
        .select(`
          id,
          request_id,
          firstname,
          lastname,
          email,
          country_code,
          created_at,
          affiliates(name),
          lead_distributions(
            id,
            advertiser_id,
            status,
            response,
            created_at,
            advertisers(name)
          )
        `)
        .eq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (rejectedError) throw rejectedError;

      // Also fetch from rejected_leads table (per-advertiser rejections)
      const { data: rejectedLeadsTable, error: tableError } = await supabase
        .from('rejected_leads')
        .select(`
          *,
          leads(firstname, lastname, email, country_code, request_id, created_at),
          advertisers(name)
        `)
        .order('created_at', { ascending: false });
      
      if (tableError) throw tableError;

      // For status rejected leads, create one entry per failed distribution
      const statusRejected: any[] = [];
      (rejectedStatusLeads || []).forEach(lead => {
        const failedDistributions = (lead.lead_distributions || []).filter(
          (d: any) => d.status === 'failed'
        );
        
        if (failedDistributions.length > 0) {
          // Create an entry for each failed distribution
          failedDistributions.forEach((dist: any) => {
            statusRejected.push({
              id: `status-${lead.id}-${dist.id}`,
              lead_id: lead.id,
              advertiser_id: dist.advertiser_id,
              reason: dist.response || 'Distribution failed',
              created_at: dist.created_at || lead.created_at,
              leads: {
                firstname: lead.firstname,
                lastname: lead.lastname,
                email: lead.email,
                country_code: lead.country_code,
                request_id: lead.request_id,
                created_at: lead.created_at,
              },
              advertisers: dist.advertisers || { name: 'Unknown' },
              source: 'status' as const,
            });
          });
        } else {
          // No distribution records, show generic entry
          statusRejected.push({
            id: `status-${lead.id}`,
            lead_id: lead.id,
            advertiser_id: null,
            reason: 'No advertiser available',
            created_at: lead.created_at,
            leads: {
              firstname: lead.firstname,
              lastname: lead.lastname,
              email: lead.email,
              country_code: lead.country_code,
              request_id: lead.request_id,
              created_at: lead.created_at,
            },
            advertisers: { name: 'None Available' },
            source: 'status' as const,
          });
        }
      });

      const tableRejected = (rejectedLeadsTable || []).map(item => ({
        ...item,
        source: 'table' as const,
      }));

      return [...statusRejected, ...tableRejected];
    },
  });
}

export function useDeleteRejectedLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: Array<{ id: string; source: 'status' | 'table'; lead_id?: string }>) => {
      // Separate by source
      const statusItems = items.filter(item => item.source === 'status');
      const tableItems = items.filter(item => item.source === 'table');

      // Delete leads with rejected status (this removes the lead entirely)
      if (statusItems.length > 0) {
        const leadIds = statusItems.map(item => item.lead_id || item.id.replace('status-', ''));
        const { error: leadsError } = await supabase
          .from('leads')
          .delete()
          .in('id', leadIds);
        
        if (leadsError) throw leadsError;
      }

      // Delete from rejected_leads table
      if (tableItems.length > 0) {
        const rejectedLeadIds = tableItems.map(item => item.id);
        const { error: tableError } = await supabase
          .from('rejected_leads')
          .delete()
          .in('id', rejectedLeadIds);
        
        if (tableError) throw tableError;
      }

      return items.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['rejected-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Deleted ${count} rejected lead${count > 1 ? 's' : ''}`);
    },
    onError: (error) => {
      console.error('Error deleting rejected leads:', error);
      toast.error('Failed to delete rejected leads');
    },
  });
}
