import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type InjectionStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type InjectionLeadStatus = 'pending' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface Injection {
  id: string;
  name: string;
  pool_id: string;
  advertiser_ids: string[];
  status: InjectionStatus;
  filter_countries: string[];
  filter_affiliate_ids: string[];
  filter_from_date: string | null;
  filter_to_date: string | null;
  geo_caps: Record<string, number>;
  geo_caps_baseline: Record<string, number> | null; // Sent counts at resume time
  min_delay_seconds: number;
  max_delay_seconds: number;
  noise_level: 'low' | 'medium' | 'high';
  working_start_time: string | null;
  working_end_time: string | null;
  working_days: string[];
  smart_mode: boolean;
  offer_name: string | null;
  total_leads: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  next_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  pool?: { id: string; name: string };
}

export interface InjectionLead {
  id: string;
  injection_id: string;
  pool_lead_id: string | null;
  advertiser_id: string | null;
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
  advertiser?: { id: string; name: string };
}

export interface CreateInjectionData {
  name: string;
  pool_id: string;
  advertiser_ids?: string[];
  filter_countries?: string[];
  filter_affiliate_ids?: string[];
  filter_from_date?: string;
  filter_to_date?: string;
  geo_caps?: Record<string, number>;
  min_delay_seconds?: number;
  max_delay_seconds?: number;
  noise_level?: 'low' | 'medium' | 'high';
  working_start_time?: string;
  working_end_time?: string;
  working_days?: string[];
}

export function useInjections() {
  return useQuery({
    queryKey: ['injections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injections')
        .select(`
          *,
          pool:lead_pools(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Injection[];
    },
  });
}

export function useInjection(id: string) {
  const queryClient = useQueryClient();

  // Set up real-time subscription for injection updates (including next_scheduled_at)
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`injection-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'injections',
          filter: `id=eq.${id}`,
        },
        () => {
          // Invalidate and refetch when injection is updated
          queryClient.invalidateQueries({ queryKey: ['injection', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  return useQuery({
    queryKey: ['injection', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injections')
        .select(`
          *,
          pool:lead_pools(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as Injection;
    },
    enabled: !!id,
    refetchInterval: 10000, // Also poll every 10 seconds as backup
  });
}

export function useInjectionLeads(injectionId: string) {
  const queryClient = useQueryClient();

  // Set up real-time subscription
  useEffect(() => {
    if (!injectionId) return;

    const channel = supabase
      .channel(`injection-leads-${injectionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'injection_leads',
          filter: `injection_id=eq.${injectionId}`,
        },
        () => {
          // Invalidate and refetch when any change occurs
          queryClient.invalidateQueries({ queryKey: ['injection-leads', injectionId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [injectionId, queryClient]);

  return useQuery({
    queryKey: ['injection-leads', injectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injection_leads')
        .select(`
          *,
          advertiser:advertisers(id, name)
        `)
        .eq('injection_id', injectionId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as InjectionLead[];
    },
    enabled: !!injectionId,
    refetchInterval: 5000, // Also poll every 5 seconds as backup
  });
}

export function useCreateInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (injection: CreateInjectionData) => {
      const { data, error } = await supabase
        .from('injections')
        .insert(injection as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      toast.success('Injection created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Injection> & { id: string }) => {
      const { data, error } = await supabase
        .from('injections')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Check if schedule-related settings changed - trigger reschedule
      const scheduleSettings = [
        'working_start_time', 'working_end_time', 'working_days',
        'min_delay_seconds', 'max_delay_seconds', 'noise_level'
      ];
      const hasScheduleChanges = scheduleSettings.some(key => key in updates);
      
      if (hasScheduleChanges) {
        // Reschedule all pending/scheduled leads
        await supabase.functions.invoke('send-injection', {
          body: { injection_id: id, action: 'reschedule' },
        });
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      queryClient.invalidateQueries({ queryKey: ['injection', data.id] });
      queryClient.invalidateQueries({ queryKey: ['injection-leads', data.id] });
      toast.success('Injection updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('injections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      toast.success('Injection deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCopyLeadsToInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      injectionId,
      poolId,
      advertiserIds,
      geoCaps,
      filters,
      limit
    }: { 
      injectionId: string;
      poolId: string;
      advertiserIds: string[];
      geoCaps?: Record<string, number>;
      filters: {
        countries?: string[];
        affiliateIds?: string[];
        fromDate?: string;
        toDate?: string;
      };
      limit?: number;
    }): Promise<{ count: number; total: number; duplicateCount: number }> => {
      // Call the filter-pool-leads function to get eligible leads (excluding duplicates + already in injection)
      const { data: filterResult, error: filterError } = await supabase.functions.invoke('filter-pool-leads', {
        body: {
          pool_id: poolId,
          advertiser_ids: advertiserIds,
          injection_id: injectionId, // Exclude leads already in this injection
          geo_caps: geoCaps, // Apply GEO caps to limit per country
          filters: {
            countries: filters.countries,
            affiliateIds: filters.affiliateIds,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
          },
          limit,
        },
      });

      if (filterError) throw filterError;
      if (filterResult?.error) throw new Error(filterResult.error);

      const eligibleLeads = filterResult?.eligible_leads || [];
      const duplicateCount = filterResult?.duplicate_count || 0;

      if (eligibleLeads.length === 0) {
        if (duplicateCount > 0) {
          throw new Error(`All ${duplicateCount} matching leads are duplicates for the selected advertiser(s)`);
        }
        throw new Error('No leads match the selected filters');
      }

      // Copy eligible leads to injection
      const injectionLeads = eligibleLeads.map((lead: {
        id: string;
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
      }) => ({
        injection_id: injectionId,
        pool_lead_id: lead.id,
        firstname: lead.firstname,
        lastname: lead.lastname,
        email: lead.email,
        mobile: lead.mobile,
        country_code: lead.country_code,
        country: lead.country,
        ip_address: lead.ip_address,
        offer_name: lead.offer_name,
        custom1: lead.custom1,
        custom2: lead.custom2,
        custom3: lead.custom3,
        comment: lead.comment,
        status: 'pending' as const,
      }));

      const { error: insertError } = await supabase
        .from('injection_leads')
        .insert(injectionLeads as any);

      if (insertError) throw insertError;

      // Get actual total count of leads in injection
      const { count: totalCount, error: countError } = await supabase
        .from('injection_leads')
        .select('*', { count: 'exact', head: true })
        .eq('injection_id', injectionId);

      if (countError) throw countError;

      // Update injection total_leads count with actual count
      const { error: updateError } = await supabase
        .from('injections')
        .update({ total_leads: totalCount || 0 })
        .eq('id', injectionId);

      if (updateError) throw updateError;

      return { count: eligibleLeads.length, total: totalCount || 0, duplicateCount };
    },
    onSuccess: ({ count, total, duplicateCount }, { injectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['injection', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injection-leads', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      
      let message = `${count} leads added (${total} total in injection)`;
      if (duplicateCount > 0) {
        message += `, ${duplicateCount} duplicates skipped`;
      }
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useStartInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (injectionId: string) => {
      // DO NOT update status here - let the backend be the single source of truth
      // This allows the backend to correctly detect the current status (paused/completed)
      // and set the geo_caps_baseline appropriately for fresh cap evaluation

      // Trigger the send-injection edge function which handles status + baseline
      const { data, error: fnError } = await supabase.functions.invoke('send-injection', {
        body: { injection_id: injectionId, action: 'start' },
      });

      if (fnError) throw fnError;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: (_, injectionId) => {
      queryClient.invalidateQueries({ queryKey: ['injection', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injection-leads', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      toast.success('Injection started');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useResumeInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (injectionId: string) => {
      // Call resume action which:
      // 1. Un-skips leads that were skipped due to GEO cap target reached
      // 2. Resets injection status to running
      // 3. Starts processing again
      const { data, error } = await supabase.functions.invoke('send-injection', {
        body: { injection_id: injectionId, action: 'resume' },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data, injectionId) => {
      queryClient.invalidateQueries({ queryKey: ['injection', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injection-leads', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      const restored = (data as any)?.restored_count || 0;
      if (restored > 0) {
        toast.success(`Injection resumed - ${restored} leads restored from skipped`);
      } else {
        toast.success('Injection resumed');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function usePauseInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (injectionId: string) => {
      // Pause + clear schedule via backend (service role) so it always succeeds
      const { data, error } = await supabase.functions.invoke('send-injection', {
        body: { injection_id: injectionId, action: 'pause' },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: (_, injectionId) => {
      queryClient.invalidateQueries({ queryKey: ['injection', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injection-leads', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      toast.success('Injection paused - schedule cleared');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}


export function useHideInjectionLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (injectionId: string) => {
      // Hide all injection_leads for this injection (data preserved)
      const { error: hideError } = await supabase
        .from('injection_leads')
        .update({ is_hidden: true })
        .eq('injection_id', injectionId);

      if (hideError) throw hideError;

      // Note: We don't reset counters because leads are hidden, not deleted
      // The counters reflect historical data for auditing
    },
    onSuccess: (_, injectionId) => {
      queryClient.invalidateQueries({ queryKey: ['injection', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injection-leads', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      toast.success('All leads hidden from injection view');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export interface InjectionValidationResult {
  total_leads: number;
  will_send: number;
  will_skip_duplicates: number;
  will_skip_geo_cap: number;
  duplicate_emails: string[];
  advertisers: {
    id: string;
    name: string;
    duplicates: number;
  }[];
  geo_breakdown: {
    country_code: string;
    leads: number;
    cap: number | null;
    will_send: number;
    will_skip: number;
  }[];
}

export function useValidateInjection() {
  return useMutation({
    mutationFn: async (injectionId: string): Promise<InjectionValidationResult> => {
      const { data, error } = await supabase.functions.invoke('validate-injection', {
        body: { injection_id: injectionId },
      });

      if (error) throw error;
      return data as InjectionValidationResult;
    },
    onError: (error: Error) => {
      toast.error(`Validation failed: ${error.message}`);
    },
  });
}

export function useSyncInjectionCounters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (injectionId: string) => {
      // Get actual counts from injection_leads
      const { data: leads, error: leadsError } = await supabase
        .from('injection_leads')
        .select('status')
        .eq('injection_id', injectionId);

      if (leadsError) throw leadsError;

      const counts = {
        total_leads: leads?.length || 0,
        sent_count: leads?.filter(l => l.status === 'sent').length || 0,
        failed_count: leads?.filter(l => l.status === 'failed').length || 0,
        skipped_count: leads?.filter(l => l.status === 'skipped').length || 0,
      };

      // Update injection with actual counts
      const { error: updateError } = await supabase
        .from('injections')
        .update(counts)
        .eq('id', injectionId);

      if (updateError) throw updateError;

      return counts;
    },
    onSuccess: (counts, injectionId) => {
      queryClient.invalidateQueries({ queryKey: ['injection', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      toast.success(`Counters synced: ${counts.total_leads} total, ${counts.sent_count} sent, ${counts.failed_count} failed`);
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}

export function useResetInjection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (injectionId: string) => {
      // First, check if injection is running - if so, pause it first
      const { data: currentInjection, error: fetchError } = await supabase
        .from('injections')
        .select('status')
        .eq('id', injectionId)
        .single();

      if (fetchError) throw fetchError;

      // If running, pause first via edge function to clear scheduler
      if (currentInjection?.status === 'running') {
        const { error: pauseError } = await supabase.functions.invoke('send-injection', {
          body: { injection_id: injectionId, action: 'pause' },
        });
        if (pauseError) throw pauseError;
      }

      // Get current lead count for reference
      const { count: leadCount, error: countError } = await supabase
        .from('injection_leads')
        .select('*', { count: 'exact', head: true })
        .eq('injection_id', injectionId)
        .eq('is_hidden', false);

      if (countError) throw countError;

      // Reset ALL leads to pending status and clear scheduling/response data
      const { error: leadsUpdateError } = await supabase
        .from('injection_leads')
        .update({
          status: 'pending',
          scheduled_at: null,
          sent_at: null,
          response: null,
          error_message: null,
          autologin_url: null,
          external_lead_id: null,
          advertiser_id: null, // Clear advertiser assignment for fresh distribution
        })
        .eq('injection_id', injectionId)
        .eq('is_hidden', false);

      if (leadsUpdateError) throw leadsUpdateError;

      // Reset injection status and counters
      const { error: updateError } = await supabase
        .from('injections')
        .update({
          status: 'draft',
          next_scheduled_at: null,
          geo_caps_baseline: null, // Clear baseline for fresh cap evaluation
          sent_count: 0,
          failed_count: 0,
          skipped_count: 0,
        })
        .eq('id', injectionId);

      if (updateError) throw updateError;

      return { leadCount: leadCount || 0, wasPaused: currentInjection?.status === 'running' };
    },
    onSuccess: ({ leadCount, wasPaused }, injectionId) => {
      queryClient.invalidateQueries({ queryKey: ['injection', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injection-leads', injectionId] });
      queryClient.invalidateQueries({ queryKey: ['injections'] });
      const msg = wasPaused 
        ? `Injection stopped and reset - ${leadCount} leads ready to send`
        : `Injection reset - ${leadCount} leads ready to send`;
      toast.success(msg);
    },
    onError: (error: Error) => {
      toast.error(`Reset failed: ${error.message}`);
    },
  });
}
