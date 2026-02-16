import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type Affiliate = Database['public']['Tables']['affiliates']['Row'];
type AffiliateInsert = Database['public']['Tables']['affiliates']['Insert'];
type AffiliateUpdate = Database['public']['Tables']['affiliates']['Update'];

export function useAffiliates() {
  return useQuery({
    queryKey: ['affiliates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useAffiliate(id: string) {
  return useQuery({
    queryKey: ['affiliate', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateAffiliate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (affiliate: AffiliateInsert) => {
      const { data, error } = await supabase
        .from('affiliates')
        .insert(affiliate)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Affiliate created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateAffiliate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Affiliate> & { id: string }) => {
      const { data, error } = await supabase
        .from('affiliates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate', data.id] });
      toast.success('Affiliate updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteAffiliate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Affiliate deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}