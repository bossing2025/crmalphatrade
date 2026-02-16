import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useTestLeadLogs(advertiserId?: string) {
  return useQuery({
    queryKey: ['test-lead-logs', advertiserId],
    queryFn: async () => {
      let query = supabase
        .from('test_lead_logs')
        .select(`
          *,
          advertisers(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (advertiserId) {
        query = query.eq('advertiser_id', advertiserId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteTestLeadLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('test_lead_logs')
        .delete()
        .in('id', ids);
      
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['test-lead-logs'] });
      toast.success(`Deleted ${count} test log${count > 1 ? 's' : ''}`);
    },
    onError: (error) => {
      console.error('Error deleting test logs:', error);
      toast.error('Failed to delete test logs');
    },
  });
}
