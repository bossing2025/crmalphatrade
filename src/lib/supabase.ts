import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper to get user roles
export const getUserRoles = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data?.map(r => r.role) || [];
};

// Check if user has a specific role
type AppRole = 'super_admin' | 'manager' | 'agent' | 'affiliate';

export const hasRole = async (userId: string, role: AppRole) => {
  const { data, error } = await supabase
    .rpc('has_role', { _user_id: userId, _role: role });
  
  if (error) throw error;
  return data;
};