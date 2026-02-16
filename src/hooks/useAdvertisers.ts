import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type Advertiser = Database['public']['Tables']['advertisers']['Row'];
type AdvertiserInsert = Database['public']['Tables']['advertisers']['Insert'];

export function useAdvertisers() {
  return useQuery({
    queryKey: ['advertisers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useAdvertiser(id: string) {
  return useQuery({
    queryKey: ['advertiser', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisers')
        .select(`
          *,
          advertiser_distribution_settings(*),
          advertiser_conversions(*)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateAdvertiser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (advertiser: AdvertiserInsert) => {
      const { data, error } = await supabase
        .from('advertisers')
        .insert(advertiser)
        .select()
        .single();
      
      if (error) throw error;
      
      // Create default conversion record
      await supabase
        .from('advertiser_conversions')
        .insert({ advertiser_id: data.id });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisers'] });
      toast.success('Advertiser created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateAdvertiser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Advertiser> & { id: string }) => {
      const { data, error } = await supabase
        .from('advertisers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['advertisers'] });
      queryClient.invalidateQueries({ queryKey: ['advertiser', data.id] });
      toast.success('Advertiser updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteAdvertiser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('advertisers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisers'] });
      toast.success('Advertiser deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}