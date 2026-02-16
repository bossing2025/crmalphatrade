import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DeliveredLeadsCount {
  advertiser_id: string;
  country_code: string;
  delivered_count: number;
}

export function useDeliveredLeadsCount() {
  return useQuery({
    queryKey: ['delivered-leads-count'],
    queryFn: async (): Promise<DeliveredLeadsCount[]> => {
      // Get count of successfully sent leads per advertiser + country
      const { data, error } = await supabase
        .from('lead_distributions')
        .select(`
          advertiser_id,
          lead:leads!inner(country_code)
        `)
        .eq('status', 'sent');

      if (error) throw error;

      // Aggregate counts by advertiser + country
      const countMap = new Map<string, number>();
      
      data?.forEach((dist: any) => {
        const key = `${dist.advertiser_id}:${dist.lead.country_code}`;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      });

      // Convert to array
      return Array.from(countMap.entries()).map(([key, count]) => {
        const [advertiser_id, country_code] = key.split(':');
        return {
          advertiser_id,
          country_code,
          delivered_count: count,
        };
      });
    },
  });
}

// Helper to get delivered count for a specific advertiser + country
export function getDeliveredCount(
  data: DeliveredLeadsCount[] | undefined,
  advertiserId: string,
  countryCode: string
): number {
  if (!data) return 0;
  const found = data.find(
    d => d.advertiser_id === advertiserId && d.country_code === countryCode
  );
  return found?.delivered_count || 0;
}
