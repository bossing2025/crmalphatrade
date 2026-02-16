import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalSentLead {
  id: string;
  email: string;
  advertiser_id: string;
  injection_id: string | null;
  sent_at: string;
  country_code: string | null;
  created_at: string;
  advertiser?: { id: string; name: string };
}

interface UseGlobalSentLeadsOptions {
  email?: string;
  advertiser_id?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export function useGlobalSentLeads(options: UseGlobalSentLeadsOptions = {}) {
  const { email, advertiser_id, fromDate, toDate, limit = 25, offset = 0 } = options;

  return useQuery({
    queryKey: ["global-sent-leads", email, advertiser_id, fromDate, toDate, limit, offset],
    queryFn: async () => {
      let query = supabase
        .from("global_sent_leads")
        .select(
          `
          id,
          email,
          advertiser_id,
          injection_id,
          sent_at,
          country_code,
          created_at,
          advertisers(id, name)
        `,
          { count: "exact" }
        )
        .order("sent_at", { ascending: false });

      if (email && email.trim()) {
        query = query.ilike("email", `%${email.toLowerCase()}%`);
      }

      if (advertiser_id) {
        query = query.eq("advertiser_id", advertiser_id);
      }

      if (fromDate) {
        query = query.gte("sent_at", fromDate.toISOString());
      }

      if (toDate) {
        const toDateEndOfDay = new Date(toDate);
        toDateEndOfDay.setHours(23, 59, 59, 999);
        query = query.lte("sent_at", toDateEndOfDay.toISOString());
      }

      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        leads: (data || []) as (GlobalSentLead & { advertisers: { id: string; name: string } | null })[],
        total: count || 0,
      };
    },
  });
}

export function getCooldownStatus(sentAt: string): {
  status: "available" | "24h-protection" | "5d-cooldown";
  daysRemaining: number;
  hoursRemaining: number;
} {
  const now = new Date().getTime();
  const sentTime = new Date(sentAt).getTime();
  const timeSinceSent = now - sentTime;

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  if (timeSinceSent < TWENTY_FOUR_HOURS_MS) {
    const remaining = TWENTY_FOUR_HOURS_MS - timeSinceSent;
    const hoursRemaining = Math.ceil(remaining / (60 * 60 * 1000));
    return {
      status: "24h-protection",
      daysRemaining: 0,
      hoursRemaining,
    };
  }

  if (timeSinceSent < FIVE_DAYS_MS) {
    const remaining = FIVE_DAYS_MS - timeSinceSent;
    const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    return {
      status: "5d-cooldown",
      daysRemaining,
      hoursRemaining: 0,
    };
  }

  return {
    status: "available",
    daysRemaining: 0,
    hoursRemaining: 0,
  };
}
