import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type InjectionPoolStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type InjectionLeadStatus = 'pending' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface InjectionPool {
  id: string;
  name: string;
  advertiser_id: string;
  status: InjectionPoolStatus;
  source_affiliate_ids: string[];
  source_from_date: string | null;
  source_to_date: string | null;
  source_countries: string[];
  geo_caps: Record<string, number>;
  min_delay_seconds: number;
  max_delay_seconds: number;
  noise_level: 'low' | 'medium' | 'high';
  working_start_time: string | null;
  working_end_time: string | null;
  working_days: string[];
  total_leads: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  next_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  advertiser?: { id: string; name: string };
}

export interface InjectionPoolLead {
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
  status: InjectionLeadStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  autologin_url: string | null;
  external_lead_id: string | null;
  response: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CreateInjectionPoolData {
  name: string;
  advertiser_id: string;
  source_affiliate_ids?: string[];
  source_from_date?: string;
  source_to_date?: string;
  source_countries?: string[];
  geo_caps?: Record<string, number>;
  min_delay_seconds?: number;
  max_delay_seconds?: number;
  noise_level?: 'low' | 'medium' | 'high';
  working_start_time?: string;
  working_end_time?: string;
  working_days?: string[];
}

export function useInjectionPools() {
  return useQuery({
    queryKey: ['injection-pools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injection_pools')
        .select(`
          *,
          advertiser:advertisers(id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as InjectionPool[];
    },
  });
}

export function useInjectionPool(id: string) {
  return useQuery({
    queryKey: ['injection-pool', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injection_pools')
        .select(`
          *,
          advertiser:advertisers(id, name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as unknown as InjectionPool;
    },
    enabled: !!id,
  });
}

export function useInjectionPoolLeads(poolId: string) {
  return useQuery({
    queryKey: ['injection-pool-leads', poolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injection_pool_leads')
        .select('*')
        .eq('pool_id', poolId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as InjectionPoolLead[];
    },
    enabled: !!poolId,
  });
}

export function useCreateInjectionPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pool: CreateInjectionPoolData) => {
      const { data, error } = await supabase
        .from('injection_pools')
        .insert(pool as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-pools'] });
      toast.success('Injection pool created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateInjectionPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InjectionPool> & { id: string }) => {
      const { data, error } = await supabase
        .from('injection_pools')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['injection-pools'] });
      queryClient.invalidateQueries({ queryKey: ['injection-pool', data.id] });
      toast.success('Pool updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteInjectionPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('injection_pools')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-pools'] });
      toast.success('Pool deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddLeadsToPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ poolId, leads }: { poolId: string; leads: Omit<InjectionPoolLead, 'id' | 'pool_id' | 'status' | 'created_at'>[] }) => {
      const leadsToInsert = leads.map(lead => ({
        ...lead,
        pool_id: poolId,
        status: 'pending' as const,
      }));
      
      const { data, error } = await supabase
        .from('injection_pool_leads')
        .insert(leadsToInsert as any)
        .select();
      
      if (error) throw error;
      
      // Update total_leads count
      const { error: updateError } = await supabase
        .from('injection_pools')
        .update({ total_leads: leadsToInsert.length })
        .eq('id', poolId);
      
      if (updateError) throw updateError;
      
      return data;
    },
    onSuccess: (_, { poolId }) => {
      queryClient.invalidateQueries({ queryKey: ['injection-pool', poolId] });
      queryClient.invalidateQueries({ queryKey: ['injection-pool-leads', poolId] });
      queryClient.invalidateQueries({ queryKey: ['injection-pools'] });
      toast.success('Leads added to pool');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useStartInjectionPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (poolId: string) => {
      // Update pool status to running
      const { error } = await supabase
        .from('injection_pools')
        .update({ status: 'running' as const })
        .eq('id', poolId);
      
      if (error) throw error;
      
      // Trigger the send-injection edge function
      const { error: fnError } = await supabase.functions.invoke('send-injection', {
        body: { pool_id: poolId, action: 'start' },
      });
      
      if (fnError) throw fnError;
    },
    onSuccess: (_, poolId) => {
      queryClient.invalidateQueries({ queryKey: ['injection-pool', poolId] });
      queryClient.invalidateQueries({ queryKey: ['injection-pools'] });
      toast.success('Injection started');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function usePauseInjectionPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (poolId: string) => {
      const { error } = await supabase
        .from('injection_pools')
        .update({ status: 'paused' as const })
        .eq('id', poolId);
      
      if (error) throw error;
    },
    onSuccess: (_, poolId) => {
      queryClient.invalidateQueries({ queryKey: ['injection-pool', poolId] });
      queryClient.invalidateQueries({ queryKey: ['injection-pools'] });
      toast.success('Injection paused');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
