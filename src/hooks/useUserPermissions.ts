import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export type UserPermission = 
  | 'view_phone'
  | 'view_email'
  | 'export_leads'
  | 'delete_leads'
  | 'edit_leads'
  | 'view_all_leads';

export const AVAILABLE_PERMISSIONS: { id: UserPermission; label: string; description: string }[] = [
  { id: 'view_phone', label: 'View Phone Numbers', description: 'Can see lead phone numbers' },
  { id: 'view_email', label: 'View Emails', description: 'Can see lead email addresses' },
  { id: 'export_leads', label: 'Export Leads', description: 'Can export leads to CSV' },
  { id: 'delete_leads', label: 'Delete Leads', description: 'Can delete leads' },
  { id: 'edit_leads', label: 'Edit Leads', description: 'Can edit lead information' },
  { id: 'view_all_leads', label: 'View All Leads', description: 'Can view all leads (not just assigned)' },
];

export function useUserPermissions(userId?: string) {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", userId);
      
      if (error) throw error;
      return (data?.map(p => p.permission) || []) as UserPermission[];
    },
    enabled: !!userId,
  });

  return { permissions: permissions || [], isLoading };
}

export function useAllUsersPermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["all-user-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id, permission");
      
      if (error) throw error;
      
      // Group by user_id
      const grouped: Record<string, UserPermission[]> = {};
      data?.forEach(p => {
        if (!grouped[p.user_id]) grouped[p.user_id] = [];
        grouped[p.user_id].push(p.permission as UserPermission);
      });
      
      return grouped;
    },
  });

  return { permissionsByUser: data || {}, isLoading };
}

export function useCurrentUserPermissions() {
  const { user, isSuperAdmin } = useAuth();
  
  const { data: permissions, isLoading } = useQuery({
    queryKey: ["current-user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return (data?.map(p => p.permission) || []) as UserPermission[];
    },
    enabled: !!user?.id,
  });

  // Super admins always have all permissions
  const hasPermission = (permission: UserPermission): boolean => {
    if (isSuperAdmin) return true;
    return permissions?.includes(permission) || false;
  };

  return {
    permissions: permissions || [],
    isLoading,
    hasPermission,
    canViewPhone: hasPermission('view_phone'),
    canViewEmail: hasPermission('view_email'),
    canExportLeads: hasPermission('export_leads'),
    canDeleteLeads: hasPermission('delete_leads'),
    canEditLeads: hasPermission('edit_leads'),
    canViewAllLeads: hasPermission('view_all_leads'),
  };
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      permission, 
      action 
    }: { 
      userId: string; 
      permission: UserPermission; 
      action: 'add' | 'remove' 
    }) => {
      if (action === 'add') {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: userId, permission: permission as any });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("permission", permission as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["all-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] });
      toast.success(`Permission ${variables.action === 'add' ? 'granted' : 'revoked'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update permission");
    },
  });
}
