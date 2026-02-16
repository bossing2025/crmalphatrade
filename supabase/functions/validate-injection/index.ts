import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ValidationResult {
  total_leads: number;
  will_send: number;
  will_skip_duplicates: number;
  will_skip_geo_cap: number;
  duplicate_emails: string[];
  advertisers: {
    id: string;
    name: string;
    duplicates: number;
  }[];
  geo_breakdown: {
    country_code: string;
    leads: number;
    cap: number | null;
    will_send: number;
    will_skip: number;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));

    // Health check support
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "validate-injection" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { injection_id } = body;

    if (!injection_id) {
      return new Response(JSON.stringify({ error: 'injection_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get injection with advertiser IDs and GEO caps
    const { data: injection, error: injectionError } = await supabase
      .from('injections')
      .select('id, name, advertiser_ids, geo_caps, geo_caps_baseline')
      .eq('id', injection_id)
      .single();

    if (injectionError || !injection) {
      return new Response(JSON.stringify({ error: 'Injection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const advertiserIds = injection.advertiser_ids || [];
    const geoCaps = (injection.geo_caps as Record<string, number>) || {};
    const geoBaseline = (injection.geo_caps_baseline as Record<string, number>) || {};

    // Get advertisers info
    const { data: advertisers } = await supabase
      .from('advertisers')
      .select('id, name')
      .in('id', advertiserIds);

    const advertiserMap = new Map(advertisers?.map(a => [a.id, a.name]) || []);

    // Get all pending leads for this injection (with country_code for GEO cap calculation)
    const { data: pendingLeads, error: leadsError } = await supabase
      .from('injection_leads')
      .select('id, email, country_code')
      .eq('injection_id', injection_id)
      .eq('status', 'pending')
      .eq('is_hidden', false);

    if (leadsError) {
      throw leadsError;
    }

    const totalLeads = pendingLeads?.length || 0;

    if (totalLeads === 0) {
      return new Response(JSON.stringify({
        total_leads: 0,
        will_send: 0,
        will_skip_duplicates: 0,
        will_skip_geo_cap: 0,
        duplicate_emails: [],
        advertisers: [],
        geo_breakdown: [],
      } as ValidationResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emails = pendingLeads!.map(l => l.email.toLowerCase());
    const uniqueEmails = [...new Set(emails)];

    // Track duplicates per advertiser
    const duplicatesPerAdvertiser: Record<string, Set<string>> = {};
    advertiserIds.forEach((id: string) => duplicatesPerAdvertiser[id] = new Set());

    // Check against injection_leads - leads sent via previous injections
    for (const advertiserId of advertiserIds) {
      // Get all injections for this advertiser
      const { data: advertiserInjections } = await supabase
        .from('injections')
        .select('id')
        .contains('advertiser_ids', [advertiserId]);

      const injectionIds = advertiserInjections?.map(i => i.id) || [];

      if (injectionIds.length > 0) {
        // Get sent leads from those injections
        const { data: sentLeads } = await supabase
          .from('injection_leads')
          .select('email')
          .in('injection_id', injectionIds)
          .in('status', ['sent', 'failed', 'skipped'])
          .in('email', uniqueEmails);

        sentLeads?.forEach(l => {
          duplicatesPerAdvertiser[advertiserId].add(l.email.toLowerCase());
        });
      }
    }

    // Check against lead_distributions - leads sent via normal flow
    for (const advertiserId of advertiserIds) {
      // First get leads with matching emails
      const { data: matchingLeads } = await supabase
        .from('leads')
        .select('id, email')
        .in('email', uniqueEmails);

      if (matchingLeads?.length) {
        const leadIds = matchingLeads.map(l => l.id);
        
        // Check which of these were distributed to this advertiser
        const { data: distributions } = await supabase
          .from('lead_distributions')
          .select('lead_id')
          .eq('advertiser_id', advertiserId)
          .eq('status', 'sent')
          .in('lead_id', leadIds);

        const distributedLeadIds = new Set(distributions?.map(d => d.lead_id) || []);
        
        matchingLeads.forEach(lead => {
          if (distributedLeadIds.has(lead.id)) {
            duplicatesPerAdvertiser[advertiserId].add(lead.email.toLowerCase());
          }
        });
      }
    }

    // Aggregate: an email is skipped if ALL advertisers already have it
    const allDuplicateEmails = new Set<string>();
    
    for (const email of uniqueEmails) {
      const canSendToAny = advertiserIds.some((id: string) => !duplicatesPerAdvertiser[id].has(email));
      if (!canSendToAny) {
        allDuplicateEmails.add(email);
      }
    }

    // Get current sent counts per country (for GEO cap calculation)
    const { data: sentLeadsByCountry } = await supabase
      .from('injection_leads')
      .select('country_code')
      .eq('injection_id', injection_id)
      .eq('status', 'sent')
      .eq('is_hidden', false);

    const currentSentPerCountry: Record<string, number> = {};
    sentLeadsByCountry?.forEach(l => {
      currentSentPerCountry[l.country_code] = (currentSentPerCountry[l.country_code] || 0) + 1;
    });

    // Calculate GEO breakdown with caps
    const leadsPerCountry: Record<string, { leads: string[]; emails: string[] }> = {};
    pendingLeads!.forEach(l => {
      if (!leadsPerCountry[l.country_code]) {
        leadsPerCountry[l.country_code] = { leads: [], emails: [] };
      }
      leadsPerCountry[l.country_code].leads.push(l.id);
      leadsPerCountry[l.country_code].emails.push(l.email.toLowerCase());
    });

    const geoBreakdown: ValidationResult['geo_breakdown'] = [];
    let totalWillSend = 0;
    let totalSkipGeoCap = 0;

    for (const [countryCode, { leads, emails }] of Object.entries(leadsPerCountry)) {
      const cap = geoCaps[countryCode] ?? null;
      const baseline = geoBaseline[countryCode] ?? 0;
      const alreadySent = currentSentPerCountry[countryCode] || 0;
      
      // Count non-duplicate leads in this country
      const nonDuplicateCount = emails.filter(e => !allDuplicateEmails.has(e)).length;
      
      let willSend = nonDuplicateCount;
      let willSkip = 0;
      
      if (cap !== null) {
        // Effective cap = cap - baseline (if resuming) + already sent this session
        // For validation: remaining = cap - (alreadySent - baseline)
        const effectiveSent = Math.max(0, alreadySent - baseline);
        const remaining = Math.max(0, cap - effectiveSent);
        
        if (nonDuplicateCount > remaining) {
          willSend = remaining;
          willSkip = nonDuplicateCount - remaining;
        }
      }
      
      geoBreakdown.push({
        country_code: countryCode,
        leads: leads.length,
        cap,
        will_send: willSend,
        will_skip: willSkip,
      });
      
      totalWillSend += willSend;
      totalSkipGeoCap += willSkip;
    }

    // Sort by leads descending
    geoBreakdown.sort((a, b) => b.leads - a.leads);

    // Build advertiser stats
    const advertiserStats = advertiserIds.map((id: string) => ({
      id,
      name: advertiserMap.get(id) || 'Unknown',
      duplicates: duplicatesPerAdvertiser[id].size,
    }));

    const result: ValidationResult = {
      total_leads: totalLeads,
      will_send: totalWillSend,
      will_skip_duplicates: allDuplicateEmails.size,
      will_skip_geo_cap: totalSkipGeoCap,
      duplicate_emails: Array.from(allDuplicateEmails).slice(0, 50),
      advertisers: advertiserStats,
      geo_breakdown: geoBreakdown,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Validate injection error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
