import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { WeeklySchedule } from "@/components/distribution/WeeklyScheduleSelector";

export interface AffiliateDistributionRule {
  id: string;
  affiliate_id: string;
  country_code: string;
  advertiser_id: string;
  weight: number;
  daily_cap: number | null;
  hourly_cap: number | null;
  is_active: boolean;
  priority_type: 'primary' | 'fallback';
  start_time: string | null;
  end_time: string | null;
  weekly_schedule: WeeklySchedule | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  advertiser_name?: string;
  advertiser_is_active?: boolean;
  affiliate_name?: string;
  affiliate_is_active?: boolean;
}

export function useAffiliateDistributionRules(affiliateId?: string) {
  return useQuery({
    queryKey: ["affiliate-distribution-rules", affiliateId],
    queryFn: async () => {
      let query = supabase
        .from("affiliate_distribution_rules")
        .select(`
          *,
          advertisers:advertiser_id(name, is_active),
          affiliates:affiliate_id(name, is_active)
        `)
        .order("country_code", { ascending: true })
        .order("weight", { ascending: false });

      if (affiliateId) {
        query = query.eq("affiliate_id", affiliateId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((rule: any) => ({
        ...rule,
        advertiser_name: rule.advertisers?.name,
        advertiser_is_active: rule.advertisers?.is_active ?? true,
        affiliate_name: rule.affiliates?.name,
        affiliate_is_active: rule.affiliates?.is_active ?? true,
        weekly_schedule: rule.weekly_schedule || null,
      })) as AffiliateDistributionRule[];
    },
    enabled: true,
  });
}

export function useAllDistributionRules() {
  return useQuery({
    queryKey: ["all-distribution-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_distribution_rules")
        .select(`
          *,
          advertisers:advertiser_id(name, is_active),
          affiliates:affiliate_id(name, is_active)
        `)
        .order("affiliate_id", { ascending: true })
        .order("country_code", { ascending: true })
        .order("weight", { ascending: false });

      if (error) throw error;

      return (data || []).map((rule: any) => ({
        ...rule,
        advertiser_name: rule.advertisers?.name,
        advertiser_is_active: rule.advertisers?.is_active ?? true,
        affiliate_name: rule.affiliates?.name,
        affiliate_is_active: rule.affiliates?.is_active ?? true,
      })) as AffiliateDistributionRule[];
    },
  });
}

export function useCreateDistributionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: {
      affiliate_id: string;
      country_code: string;
      advertiser_id: string;
      weight: number;
      daily_cap?: number | null;
      hourly_cap?: number | null;
      is_active?: boolean;
      priority_type?: 'primary' | 'fallback';
      start_time?: string | null;
      end_time?: string | null;
      weekly_schedule?: WeeklySchedule | null;
      timezone?: string;
    }) => {
      const { data, error } = await supabase
        .from("affiliate_distribution_rules")
        .insert(rule as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-distribution-rules"] });
      queryClient.invalidateQueries({ queryKey: ["all-distribution-rules"] });
      toast.success("Distribution rule created");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("This rule already exists (same affiliate + country + advertiser)");
      } else {
        toast.error("Failed to create rule: " + error.message);
      }
    },
  });
}

export function useUpdateDistributionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      weight?: number;
      daily_cap?: number | null;
      hourly_cap?: number | null;
      is_active?: boolean;
      priority_type?: 'primary' | 'fallback';
      start_time?: string | null;
      end_time?: string | null;
      weekly_schedule?: WeeklySchedule | null;
      timezone?: string;
    }) => {
      const { data, error } = await supabase
        .from("affiliate_distribution_rules")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-distribution-rules"] });
      queryClient.invalidateQueries({ queryKey: ["all-distribution-rules"] });
      toast.success("Rule updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update rule: " + error.message);
    },
  });
}

export function useDeleteDistributionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("affiliate_distribution_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-distribution-rules"] });
      queryClient.invalidateQueries({ queryKey: ["all-distribution-rules"] });
      toast.success("Rule deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete rule: " + error.message);
    },
  });
}

export function useBulkDeleteDistributionRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("affiliate_distribution_rules")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-distribution-rules"] });
      queryClient.invalidateQueries({ queryKey: ["all-distribution-rules"] });
      toast.success(`${ids.length} rules deleted`);
    },
    onError: (error: any) => {
      toast.error("Failed to delete rules: " + error.message);
    },
  });
}

export function useBulkCreateDistributionRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rules: {
      affiliate_id: string;
      country_code: string;
      advertiser_id: string;
      weight: number;
      daily_cap?: number | null;
      hourly_cap?: number | null;
      is_active?: boolean;
    }[]) => {
      // Insert all rules, on conflict do nothing (skip duplicates)
      const { data, error } = await supabase
        .from("affiliate_distribution_rules")
        .insert(rules as any[])
        .select();

      if (error) {
        // If it's a unique constraint violation, we need to handle partial success
        if (error.code === "23505") {
          throw new Error("Some rules already exist");
        }
        throw error;
      }

      return { created: data?.length || 0, total: rules.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-distribution-rules"] });
      queryClient.invalidateQueries({ queryKey: ["all-distribution-rules"] });
      const skipped = result.total - result.created;
      if (skipped > 0) {
        toast.success(`Created ${result.created} rules, ${skipped} skipped (already exist)`);
      } else {
        toast.success(`Created ${result.created} rules`);
      }
    },
    onError: (error: any) => {
      toast.error("Failed to create rules: " + error.message);
    },
  });
}
