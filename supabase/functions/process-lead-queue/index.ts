import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Lead {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  country_code: string;
  country?: string;
  ip_address?: string;
  affiliate_id?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  offer_name?: string;
  comment?: string;
}

interface Advertiser {
  id: string;
  name: string;
  advertiser_type: string;
  url: string;
  api_key: string;
  config: Record<string, unknown>;
  daily_cap: number;
  hourly_cap: number;
}

interface EligibleAdvertiser extends Advertiser {
  weight: number;
}

interface DaySchedule {
  is_active: boolean;
  start_time?: string;
  end_time?: string;
}

interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

// Helper to extract external lead ID from response
function extractExternalLeadId(responseText: string): string | null {
  try {
    const data = JSON.parse(responseText);
    return String(data.lead_id || data.leadId || data.id || data.data?.lead_id || 
           data.data?.leadId || data.data?.id || data.leadRequestID || '');
  } catch {
    const uuidMatch = responseText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) return uuidMatch[0];
    const numMatch = responseText.match(/"(?:lead_?id|id)":\s*(\d+)/i);
    if (numMatch) return numMatch[1];
    return null;
  }
}

// Advertiser API Adapters
const advertiserAdapters: Record<string, (lead: Lead, advertiser: Advertiser) => Promise<{ success: boolean; response: string }>> = {
  getlinked: async (lead, advertiser) => {
    const payload = {
      first_name: lead.firstname,
      last_name: lead.lastname,
      email: lead.email,
      phone_number: lead.mobile,
      country_code: lead.country_code,
      ip_address: lead.ip_address || '',
      campaign: lead.offer_name || '',
      sub_id: lead.custom1 || '',
    };

    const response = await fetch(advertiser.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': advertiser.api_key,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    return { success: response.ok, response: text };
  },

  trackbox: async (lead, advertiser) => {
    const config = advertiser.config || {};
    
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password + 'Aa1!';
    };

    const payload: Record<string, string> = {
      ai: String(config.ai || ''),
      ci: String(config.ci || ''),
      gi: String(config.gi || ''),
      userip: lead.ip_address || '0.0.0.0',
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      password: generatePassword(),
      phone: lead.mobile,
      so: lead.offer_name || '',
      sub: lead.custom1 || '',
      lg: lead.country_code || 'EN',
    };

    if (lead.custom2) payload.MPC_1 = lead.custom2;
    if (lead.custom3) payload.MPC_2 = lead.custom3;

    const apiKeyPost = String(config.api_key_post || advertiser.api_key || '');

    const response = await fetch(advertiser.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trackbox-username': String(config.username || ''),
        'x-trackbox-password': String(config.password || ''),
        'x-api-key': apiKeyPost,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    return { success: response.ok, response: text };
  },

  drmailer: async (lead, advertiser) => {
    const config = advertiser.config || {};
    
    const params = new URLSearchParams();
    params.append('apikey', advertiser.api_key || String(config.apikey || ''));
    params.append('pass', String(config.pass || ''));
    params.append('campaign_id', String(config.campaign_id || ''));
    params.append('fname', lead.firstname);
    params.append('lname', lead.lastname);
    params.append('email', lead.email);
    params.append('phone', lead.mobile);
    params.append('ip', lead.ip_address || '0.0.0.0');
    if (lead.custom1) params.append('suid', lead.custom1);
    if (lead.custom2) params.append('clickid', lead.custom2);
    if (lead.offer_name) params.append('desc', lead.offer_name);

    const apiUrl = advertiser.url || 'https://tracker.doctor-mailer.com/repost.php?act=register';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const text = await response.text();
    
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      if (json.status === 'error' || json.error) {
        isSuccess = false;
      }
    } catch {
      if (text.toLowerCase().includes('error')) {
        isSuccess = false;
      }
    }
    
    return { success: isSuccess, response: text };
  },
};

// deno-lint-ignore no-explicit-any
async function getEligibleAdvertisers(supabase: any, lead: Lead, dailyCounts: Map<string, number>, hourlyCounts: Map<string, number>): Promise<EligibleAdvertiser[]> {
  // Check affiliate-specific rules first
  if (lead.affiliate_id) {
    const { data: affiliateRules } = await supabase
      .from('affiliate_distribution_rules')
      .select('*')
      .eq('affiliate_id', lead.affiliate_id)
      .eq('country_code', lead.country_code)
      .eq('is_active', true);

    if (affiliateRules && affiliateRules.length > 0) {
      const advertiserIds = affiliateRules.map((r: { advertiser_id: string }) => r.advertiser_id);
      const { data: advertisers } = await supabase
        .from('advertisers')
        .select('*')
        .in('id', advertiserIds)
        .eq('is_active', true);

      if (!advertisers?.length) return [];

      const eligible: EligibleAdvertiser[] = [];
      const rulesMap = new Map<string, { weight: number; daily_cap: number | null; hourly_cap: number | null; start_time: string | null; end_time: string | null; weekly_schedule: WeeklySchedule | null; timezone: string | null }>();
      for (const rule of affiliateRules) {
        rulesMap.set(rule.advertiser_id, rule);
      }

      // Helper to get current time in a specific timezone
      const getTimeInTimezone = (tz: string): { day: keyof WeeklySchedule; time: string } => {
        const now = new Date();
        const days: (keyof WeeklySchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        try {
          const options: Intl.DateTimeFormatOptions = { 
            timeZone: tz, 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false,
            weekday: 'long'
          };
          const formatter = new Intl.DateTimeFormat('en-US', options);
          const parts = formatter.formatToParts(now);
          
          const hourPart = parts.find(p => p.type === 'hour');
          const minutePart = parts.find(p => p.type === 'minute');
          const weekdayPart = parts.find(p => p.type === 'weekday');
          
          const hour = hourPart?.value || '00';
          const minute = minutePart?.value || '00';
          const weekday = weekdayPart?.value?.toLowerCase() || 'monday';
          
          return {
            day: weekday as keyof WeeklySchedule,
            time: `${hour}:${minute}`
          };
        } catch {
          return {
            day: days[now.getUTCDay()],
            time: `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`
          };
        }
      };

      for (const adv of advertisers as Advertiser[]) {
        const rule = rulesMap.get(adv.id);
        if (!rule) continue;

        // Get current time in the rule's timezone
        const ruleTimezone = rule.timezone || 'UTC';
        const { day: currentDay, time: currentTimeStr } = getTimeInTimezone(ruleTimezone);

        // Check working hours from rule
        if (rule.weekly_schedule) {
          const daySchedule = rule.weekly_schedule[currentDay];
          if (!daySchedule?.is_active) continue;
          if (daySchedule.start_time && daySchedule.end_time) {
            const startTime = daySchedule.start_time.slice(0, 5);
            const endTime = daySchedule.end_time.slice(0, 5);
            if (startTime <= endTime) {
              if (currentTimeStr < startTime || currentTimeStr > endTime) continue;
            } else {
              if (currentTimeStr < startTime && currentTimeStr > endTime) continue;
            }
          }
        } else if (rule.start_time && rule.end_time) {
          const startTime = rule.start_time.slice(0, 5);
          const endTime = rule.end_time.slice(0, 5);
          if (startTime <= endTime) {
            if (currentTimeStr < startTime || currentTimeStr > endTime) continue;
          } else {
            if (currentTimeStr < startTime && currentTimeStr > endTime) continue;
          }
        }

        const dailyLimit = rule.daily_cap || adv.daily_cap || 100;
        const dailyCount = dailyCounts.get(adv.id) || 0;
        if (dailyCount >= dailyLimit) continue;

        const hourlyLimit = rule.hourly_cap || adv.hourly_cap;
        if (hourlyLimit) {
          const hourlyCount = hourlyCounts.get(adv.id) || 0;
          if (hourlyCount >= hourlyLimit) continue;
        }

        eligible.push({ ...adv, weight: rule.weight || 100 });
      }

      return eligible;
    }
  }

  // Fallback to default distribution settings
  const { data: advertisers } = await supabase
    .from('advertisers')
    .select('*')
    .eq('is_active', true);

  if (!advertisers?.length) return [];

  const { data: settings } = await supabase
    .from('advertiser_distribution_settings')
    .select('*')
    .eq('is_active', true);

  const settingsMap = new Map<string, { base_weight: number | null; default_daily_cap: number | null; default_hourly_cap: number | null; countries: string[] | null; affiliates: string[] | null; start_time: string | null; end_time: string | null }>();
  if (settings) {
    for (const s of settings) {
      settingsMap.set(s.advertiser_id, s);
    }
  }

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

  const eligible: EligibleAdvertiser[] = [];
  
  for (const adv of advertisers as Advertiser[]) {
    const setting = settingsMap.get(adv.id);

    const dailyLimit = setting?.default_daily_cap || adv.daily_cap || 100;
    const dailyCount = dailyCounts.get(adv.id) || 0;
    if (dailyCount >= dailyLimit) continue;

    const hourlyLimit = setting?.default_hourly_cap || adv.hourly_cap;
    if (hourlyLimit) {
      const hourlyCount = hourlyCounts.get(adv.id) || 0;
      if (hourlyCount >= hourlyLimit) continue;
    }

    if (setting?.countries?.length) {
      if (!setting.countries.includes(lead.country_code)) continue;
    }

    if (setting?.affiliates?.length && lead.affiliate_id) {
      if (!setting.affiliates.includes(lead.affiliate_id)) continue;
    }

    if (setting?.start_time && setting?.end_time) {
      if (currentTime < setting.start_time || currentTime > setting.end_time) continue;
    }

    eligible.push({ ...adv, weight: setting?.base_weight || 100 });
  }

  return eligible;
}

function selectWeightedAdvertiser(advertisers: EligibleAdvertiser[]): EligibleAdvertiser {
  if (advertisers.length === 1) return advertisers[0];

  const totalWeight = advertisers.reduce((sum, adv) => sum + adv.weight, 0);
  const random = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (const adv of advertisers) {
    cumulative += adv.weight;
    if (random < cumulative) return adv;
  }
  
  return advertisers[advertisers.length - 1];
}

// deno-lint-ignore no-explicit-any
async function processLead(supabase: any, lead: Lead, dailyCounts: Map<string, number>, hourlyCounts: Map<string, number>): Promise<{ success: boolean; error?: string }> {
  const eligible = await getEligibleAdvertisers(supabase, lead, dailyCounts, hourlyCounts);
  
  if (eligible.length === 0) {
    // Mark lead as rejected
    await supabase.from('leads').update({ status: 'rejected' }).eq('id', lead.id);
    return { success: false, error: 'No eligible advertisers' };
  }

  // Try advertisers in weighted order with failover
  const tried = new Set<string>();
  let remainingAdvertisers = [...eligible];

  while (remainingAdvertisers.length > 0) {
    const selected = selectWeightedAdvertiser(remainingAdvertisers);
    tried.add(selected.id);

    const adapter = advertiserAdapters[selected.advertiser_type];
    if (!adapter) {
      remainingAdvertisers = remainingAdvertisers.filter(a => a.id !== selected.id);
      continue;
    }

    try {
      const { success, response } = await adapter(lead, selected);
      const externalLeadId = success ? extractExternalLeadId(response) : null;

      if (success) {
        // Record successful distribution
        await supabase.from('lead_distributions').insert({
          lead_id: lead.id,
          advertiser_id: selected.id,
          affiliate_id: lead.affiliate_id,
          status: 'sent',
          response: response.substring(0, 1000),
          external_lead_id: externalLeadId,
          sent_at: new Date().toISOString(),
        });

        // Update lead
        await supabase.from('leads').update({
          distributed_at: new Date().toISOString(),
          status: 'new',
        }).eq('id', lead.id);

        // Update local count for subsequent leads in batch
        dailyCounts.set(selected.id, (dailyCounts.get(selected.id) || 0) + 1);
        hourlyCounts.set(selected.id, (hourlyCounts.get(selected.id) || 0) + 1);

        return { success: true };
      } else {
        // Record rejection
        await supabase.from('rejected_leads').insert({
          lead_id: lead.id,
          advertiser_id: selected.id,
          reason: response.substring(0, 500),
        });
      }
    } catch (err) {
      console.error(`Error distributing to ${selected.name}:`, err);
    }

    remainingAdvertisers = remainingAdvertisers.filter(a => a.id !== selected.id);
  }

  // All advertisers failed
  await supabase.from('leads').update({ status: 'rejected' }).eq('id', lead.id);
  return { success: false, error: 'All advertisers rejected the lead' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get batch size from request or default
    let batchSize = 50;
    let body: { batch_size?: number; health_check?: boolean } = {};
    try {
      body = await req.json();
      if (body.batch_size && typeof body.batch_size === 'number') {
        batchSize = Math.min(body.batch_size, 100); // Max 100 per batch
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Health check support
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "process-lead-queue" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing lead queue (batch size: ${batchSize})...`);

    // Get pending items from queue
    const { data: queueItems, error: fetchError } = await supabase
      .from('lead_queue')
      .select('id, lead_id, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('Error fetching queue:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in queue');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${queueItems.length} items to process`);

    // Mark items as processing
    const queueIds = queueItems.map(q => q.id);
    await supabase
      .from('lead_queue')
      .update({ status: 'processing' })
      .in('id', queueIds);

    // Pre-fetch distribution counts for efficiency
    const today = new Date().toISOString().split('T')[0];
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: dailyDistributions } = await supabase
      .from('lead_distributions')
      .select('advertiser_id')
      .gte('created_at', `${today}T00:00:00Z`)
      .eq('status', 'sent');

    const dailyCounts = new Map<string, number>();
    if (dailyDistributions) {
      for (const d of dailyDistributions) {
        dailyCounts.set(d.advertiser_id, (dailyCounts.get(d.advertiser_id) || 0) + 1);
      }
    }

    const { data: hourlyDistributions } = await supabase
      .from('lead_distributions')
      .select('advertiser_id')
      .gte('created_at', hourAgo)
      .eq('status', 'sent');

    const hourlyCounts = new Map<string, number>();
    if (hourlyDistributions) {
      for (const d of hourlyDistributions) {
        hourlyCounts.set(d.advertiser_id, (hourlyCounts.get(d.advertiser_id) || 0) + 1);
      }
    }

    // Get leads for queue items
    const leadIds = queueItems.map(q => q.lead_id);
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('id', leadIds);

    const leadsMap = new Map<string, Lead>();
    if (leads) {
      for (const lead of leads) {
        leadsMap.set(lead.id, lead as Lead);
      }
    }

    // Process each lead
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const queueItem of queueItems) {
      const lead = leadsMap.get(queueItem.lead_id);
      if (!lead) {
        await supabase.from('lead_queue').update({
          status: 'failed',
          error_message: 'Lead not found',
          processed_at: new Date().toISOString(),
        }).eq('id', queueItem.id);
        failed++;
        continue;
      }

      const result = await processLead(supabase, lead, dailyCounts, hourlyCounts);
      processed++;

      if (result.success) {
        await supabase.from('lead_queue').update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        }).eq('id', queueItem.id);
        succeeded++;
      } else {
        const newAttempts = queueItem.attempts + 1;
        if (newAttempts >= 3) {
          await supabase.from('lead_queue').update({
            status: 'failed',
            attempts: newAttempts,
            error_message: result.error,
            processed_at: new Date().toISOString(),
          }).eq('id', queueItem.id);
          failed++;
        } else {
          // Retry later
          await supabase.from('lead_queue').update({
            status: 'pending',
            attempts: newAttempts,
            error_message: result.error,
          }).eq('id', queueItem.id);
        }
      }
    }

    console.log(`Processed ${processed} leads: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        succeeded,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Queue processor error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
