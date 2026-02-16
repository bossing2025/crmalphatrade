import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CallbackLog {
  id: string;
  created_at: string;
  callback_type: string;
  processing_status: string;
  advertiser_id: string | null;
  advertiser_name: string | null;
  lead_id: string | null;
  injection_lead_id: string | null;
  matched_by: string | null;
  request_method: string;
  request_url: string | null;
  request_payload: Record<string, unknown> | null;
  request_headers: Record<string, unknown> | null;
  changes_applied: Record<string, unknown> | null;
  processing_error: string | null;
  processed_at: string | null;
  ip_address: string | null;
}

export function useCallbackLogs(limit: number = 100) {
  return useQuery({
    queryKey: ['callback-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('callback_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as CallbackLog[];
    },
    refetchInterval: 30000,
  });
}

export function useCallbackLogsCount() {
  return useQuery({
    queryKey: ['callback-logs-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('callback_logs')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });
}
