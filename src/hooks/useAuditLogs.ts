import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string;
  user_email: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changes_summary: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_path: string | null;
  created_at: string;
}

interface AuditLogsFilters {
  action?: string;
  tableName?: string;
  userEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLogs(filters: AuditLogsFilters = {}) {
  const { action, tableName, userEmail, dateFrom, dateTo, page = 1, pageSize = 50 } = filters;

  return useQuery({
    queryKey: ['audit-logs', action, tableName, userEmail, dateFrom, dateTo, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (action) {
        query = query.eq('action', action);
      }
      if (tableName) {
        query = query.eq('table_name', tableName);
      }
      if (userEmail) {
        query = query.ilike('user_email', `%${userEmail}%`);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        logs: data as AuditLog[],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

export function useAuditLogActions() {
  return useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action')
        .order('action');

      if (error) throw error;

      const uniqueActions = [...new Set(data?.map(d => d.action) || [])];
      return uniqueActions;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useAuditLogTables() {
  return useQuery({
    queryKey: ['audit-log-tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('table_name')
        .not('table_name', 'is', null)
        .order('table_name');

      if (error) throw error;

      const uniqueTables = [...new Set(data?.map(d => d.table_name).filter(Boolean) || [])];
      return uniqueTables as string[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
