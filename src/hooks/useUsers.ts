import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserWithRoles {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  created_at: string;
  roles: string[];
}

export function useUsers() {
  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, username, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Map roles to users
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        ...profile,
        roles: (roles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role),
      }));

      return usersWithRoles;
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role, action }: { userId: string; role: string; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: role as any });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success(`Role ${variables.action === 'add' ? 'added' : 'removed'} successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const updateUsername = useMutation({
    mutationFn: async ({ userId, username }: { userId: string; username: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ username })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Username updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update username");
    },
  });

  return {
    users,
    isLoading,
    error,
    updateUserRole,
    updateUsername,
  };
}
