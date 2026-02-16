import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LeadPool {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lead_count?: number;
  country_counts?: Record<string, number>;
}

export interface InjectionStatus {
  injection_id: string;
  injection_name: string;
  advertiser_id: string;
  advertiser_name: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

export interface LeadPoolLead {
  id: string;
  pool_id: string;
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  country_code: string;
  country: string | null;
  ip_address: string | null;
  offer_name: string | null;
  custom1: string | null;
  custom2: string | null;
  custom3: string | null;
  comment: string | null;
  source_affiliate_id: string | null;
  source_date: string | null;
  created_at: string;
  // Injection tracking
  injection_statuses?: InjectionStatus[];
}

export function useLeadPools() {
  return useQuery({
    queryKey: ['lead-pools'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('lead_pools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get lead counts per pool (excluding hidden leads)
      const poolsWithCounts = await Promise.all(
        pools.map(async (pool) => {
          const { data: leads } = await supabase
            .from('lead_pool_leads')
            .select('country_code')
            .eq('pool_id', pool.id)
            .eq('is_hidden', false);

          const country_counts: Record<string, number> = {};
          leads?.forEach(lead => {
            country_counts[lead.country_code] = (country_counts[lead.country_code] || 0) + 1;
          });

          return {
            ...pool,
            lead_count: leads?.length || 0,
            country_counts,
          };
        })
      );

      return poolsWithCounts as LeadPool[];
    },
  });
}

export function useLeadPool(id: string) {
  return useQuery({
    queryKey: ['lead-pool', id],
    queryFn: async () => {
      const { data: pool, error } = await supabase
        .from('lead_pools')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Get lead stats (excluding hidden leads)
      const { data: leads } = await supabase
        .from('lead_pool_leads')
        .select('country_code')
        .eq('pool_id', id)
        .eq('is_hidden', false);

      const country_counts: Record<string, number> = {};
      leads?.forEach(lead => {
        country_counts[lead.country_code] = (country_counts[lead.country_code] || 0) + 1;
      });

      return {
        ...pool,
        lead_count: leads?.length || 0,
        country_counts,
      } as LeadPool;
    },
    enabled: !!id,
  });
}

export function useLeadPoolLeads(poolId: string) {
  const queryClient = useQueryClient();

  // Subscribe to real-time updates on injection_leads
  useEffect(() => {
    if (!poolId) return;

    const channel = supabase
      .channel(`pool-leads-${poolId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'injection_leads',
        },
        (payload) => {
          console.log('Injection lead changed:', payload);
          // Invalidate the query to refetch with updated status
          queryClient.invalidateQueries({ queryKey: ['lead-pool-leads', poolId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolId, queryClient]);

  return useQuery({
    queryKey: ['lead-pool-leads', poolId],
    queryFn: async () => {
      // Get pool leads (excluding hidden leads)
      const { data: leads, error } = await supabase
        .from('lead_pool_leads')
        .select('*')
        .eq('pool_id', poolId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!leads || leads.length === 0) return [] as LeadPoolLead[];

      // Get all injection leads that reference these pool leads
      const leadIds = leads.map(l => l.id);
      const { data: injectionLeads } = await supabase
        .from('injection_leads')
        .select(`
          id,
          pool_lead_id,
          injection_id,
          advertiser_id,
          status,
          sent_at,
          error_message,
          injections:injection_id (name),
          advertisers:advertiser_id (name)
        `)
        .in('pool_lead_id', leadIds)
        .order('sent_at', { ascending: false, nullsFirst: false });

      // Get advertisers for injection leads
      const advertiserIds = [...new Set(injectionLeads?.map(il => il.advertiser_id).filter(Boolean))];
      const { data: advertisers } = await supabase
        .from('advertisers')
        .select('id, name')
        .in('id', advertiserIds.length > 0 ? advertiserIds : ['00000000-0000-0000-0000-000000000000']);

      const advertiserMap = new Map(advertisers?.map(a => [a.id, a.name]) || []);

      // Map injection status to each pool lead
      const leadsWithStatus = leads.map(lead => {
        const injections = injectionLeads?.filter(il => il.pool_lead_id === lead.id) || [];
        const injection_statuses: InjectionStatus[] = injections.map(il => ({
          injection_id: il.injection_id || '',
          injection_name: (il.injections as any)?.name || (il.injection_id === null ? 'Deleted Injection' : 'Unknown'),
          advertiser_id: il.advertiser_id || '',
          advertiser_name: advertiserMap.get(il.advertiser_id || '') || 'Unknown',
          status: il.status,
          sent_at: il.sent_at,
          error_message: il.error_message,
        }));

        return {
          ...lead,
          injection_statuses,
        };
      });

      return leadsWithStatus as LeadPoolLead[];
    },
    enabled: !!poolId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useCreateLeadPool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('lead_pools')
        .insert({ name, description })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-pools'] });
      toast.success('Lead pool created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteLeadPool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First delete all injections that reference this pool
      const { error: injectionsError } = await supabase
        .from('injections')
        .delete()
        .eq('pool_id', id);

      if (injectionsError) throw injectionsError;

      // Then delete the pool itself
      const { error } = await supabase
        .from('lead_pools')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-pools'] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      toast.success('Lead pool deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddLeadsToLeadPool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      poolId, 
      leads 
    }: { 
      poolId: string; 
      leads: Omit<LeadPoolLead, 'id' | 'pool_id' | 'created_at'>[] 
    }) => {
      const leadsToInsert = leads.map(lead => ({
        ...lead,
        pool_id: poolId,
      }));

      const { data, error } = await supabase
        .from('lead_pool_leads')
        .insert(leadsToInsert as any)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { poolId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-pool', poolId] });
      queryClient.invalidateQueries({ queryKey: ['lead-pool-leads', poolId] });
      queryClient.invalidateQueries({ queryKey: ['lead-pools'] });
      toast.success('Leads added to pool');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useHideLeadPoolLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, poolId }: { leadId: string; poolId: string }) => {
      const { error } = await supabase
        .from('lead_pool_leads')
        .update({ is_hidden: true })
        .eq('id', leadId);

      if (error) throw error;
      return poolId;
    },
    onSuccess: (poolId) => {
      queryClient.invalidateQueries({ queryKey: ['lead-pool', poolId] });
      queryClient.invalidateQueries({ queryKey: ['lead-pool-leads', poolId] });
      queryClient.invalidateQueries({ queryKey: ['lead-pools'] });
      toast.success('Lead hidden from pool');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
