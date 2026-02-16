import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AffiliateSubmissionFailure {
  id: string;
  affiliate_id: string | null;
  country_code: string | null;
  created_at: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  mobile: string | null;
  raw_payload: Record<string, unknown> | null;
  rejection_code: string;
  rejection_message: string | null;
}

export interface AffiliateSubmissionFailuresFilters {
  affiliateId?: string;
  rejectionCode?: string;
  countryCode?: string;
  search?: string;
}

export function useAffiliateSubmissionFailures(filters: AffiliateSubmissionFailuresFilters = {}) {
  return useQuery({
    queryKey: ["affiliate-submission-failures", filters],
    queryFn: async () => {
      let query = supabase
        .from("affiliate_submission_failures")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.affiliateId) {
        query = query.eq("affiliate_id", filters.affiliateId);
      }

      if (filters.rejectionCode) {
        query = query.eq("rejection_code", filters.rejectionCode);
      }

      if (filters.countryCode) {
        query = query.eq("country_code", filters.countryCode);
      }

      if (filters.search) {
        query = query.or(
          `email.ilike.%${filters.search}%,firstname.ilike.%${filters.search}%,lastname.ilike.%${filters.search}%,mobile.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching affiliate submission failures:", error);
        throw error;
      }

      return (data || []) as AffiliateSubmissionFailure[];
    },
  });
}

export function useDeleteAffiliateSubmissionFailures() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("affiliate_submission_failures")
        .delete()
        .in("id", ids);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-submission-failures"] });
      toast.success("Records deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting records:", error);
      toast.error("Failed to delete records");
    },
  });
}
