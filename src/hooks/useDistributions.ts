import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBulkDeleteDistributions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('lead_distributions')
        .delete()
        .in('id', ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      toast.success(`Deleted ${count} distribution${count > 1 ? 's' : ''}`);
    },
    onError: (error) => {
      console.error('Error deleting distributions:', error);
      toast.error('Failed to delete distributions');
    },
  });
}
