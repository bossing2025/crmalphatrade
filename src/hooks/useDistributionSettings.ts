import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type DistributionSetting = Database['public']['Tables']['advertiser_distribution_settings']['Row'];
type DistributionSettingInsert = Database['public']['Tables']['advertiser_distribution_settings']['Insert'];
type DistributionSettingUpdate = Database['public']['Tables']['advertiser_distribution_settings']['Update'];

export function useDistributionSettings() {
  return useQuery({
    queryKey: ['distribution-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertiser_distribution_settings')
        .select(`
          *,
          advertisers(id, name, is_active, advertiser_type)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useDistributionSettingsByAdvertiser(advertiserId: string) {
  return useQuery({
    queryKey: ['distribution-settings', advertiserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertiser_distribution_settings')
        .select('*')
        .eq('advertiser_id', advertiserId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!advertiserId,
  });
}

export function useCreateDistributionSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (setting: DistributionSettingInsert) => {
      const { data, error } = await supabase
        .from('advertiser_distribution_settings')
        .insert(setting)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-settings'] });
      toast.success('Distribution settings created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateDistributionSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: DistributionSettingUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('advertiser_distribution_settings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-settings'] });
      toast.success('Distribution settings updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpsertDistributionSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (setting: DistributionSettingInsert & { priority?: number }) => {
      // Check if setting exists for this advertiser
      const { data: existing } = await supabase
        .from('advertiser_distribution_settings')
        .select('id')
        .eq('advertiser_id', setting.advertiser_id)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('advertiser_distribution_settings')
          .update(setting as any)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('advertiser_distribution_settings')
          .insert(setting as any)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-settings'] });
      toast.success('Distribution settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteDistributionSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('advertiser_distribution_settings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-settings'] });
      toast.success('Distribution settings deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
