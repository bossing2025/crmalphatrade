import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PoolLead {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  mobile: string;
  country_code: string;
  country: string | null;
  ip_address: string | null;
  offer_name: string | null;
  custom1: string | null;
  custom2: string | null;
  custom3: string | null;
  comment: string | null;
  source_affiliate_id: string | null;
  source_date: string | null;
  created_at: string;
}

interface FilterRequest {
  pool_id: string;
  advertiser_ids: string[];
  injection_id?: string; // Current injection to exclude its existing leads
  geo_caps?: Record<string, number>; // GEO caps to limit leads per country
  filters?: {
    countries?: string[];
    fromDate?: string;
    toDate?: string;
    affiliateIds?: string[];
  };
  limit?: number;
}

interface FilterResponse {
  eligible_leads: PoolLead[];
  duplicate_count: number;
  duplicate_emails: string[];
  total_pool_leads: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: FilterRequest | { health_check?: boolean } = await req.json();

    // Health check support
    if ((body as { health_check?: boolean }).health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "filter-pool-leads" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pool_id, advertiser_ids, injection_id, geo_caps, filters, limit } = body as FilterRequest;

    if (!pool_id) {
      return new Response(
        JSON.stringify({ error: 'pool_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!advertiser_ids || advertiser_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'advertiser_ids is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Filtering pool ${pool_id} for advertisers: ${advertiser_ids.join(', ')}`);

    // Step 1: Get all pool leads with optional filters
    let poolQuery = supabase
      .from('lead_pool_leads')
      .select('*')
      .eq('pool_id', pool_id);

    if (filters?.countries && filters.countries.length > 0) {
      poolQuery = poolQuery.in('country_code', filters.countries);
    }
    if (filters?.affiliateIds && filters.affiliateIds.length > 0) {
      poolQuery = poolQuery.in('source_affiliate_id', filters.affiliateIds);
    }
    if (filters?.fromDate) {
      poolQuery = poolQuery.gte('source_date', filters.fromDate);
    }
    if (filters?.toDate) {
      poolQuery = poolQuery.lte('source_date', filters.toDate + 'T23:59:59');
    }

    const { data: poolLeads, error: poolError } = await poolQuery;
    
    if (poolError) {
      console.error('Error fetching pool leads:', poolError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pool leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!poolLeads || poolLeads.length === 0) {
      return new Response(
        JSON.stringify({
          eligible_leads: [],
          duplicate_count: 0,
          duplicate_emails: [],
          total_pool_leads: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${poolLeads.length} pool leads matching filters`);

    // Step 2: Get pool_lead_ids already in current injection (if provided)
    const existingPoolLeadIds = new Set<string>();
    if (injection_id) {
      const { data: existingLeads } = await supabase
        .from('injection_leads')
        .select('pool_lead_id')
        .eq('injection_id', injection_id)
        .not('pool_lead_id', 'is', null);
      
      if (existingLeads) {
        existingLeads.forEach((l: { pool_lead_id: string }) => existingPoolLeadIds.add(l.pool_lead_id));
      }
      console.log(`Found ${existingPoolLeadIds.size} leads already in current injection`);
    }

    // Step 3: Get all emails that have been sent to these advertisers (global + live)
    const duplicateEmails = new Set<string>();

    // Check global_sent_leads for all leads sent via injection globally
    console.log('Checking global_sent_leads for duplicates by advertiser_id...');
    
    const { data: globalSentLeads, error: globalError } = await supabase
      .from('global_sent_leads')
      .select('email')
      .in('advertiser_id', advertiser_ids);

    if (globalError) {
      console.error('Error fetching global sent leads:', globalError);
    } else if (globalSentLeads) {
      globalSentLeads.forEach((l: { email: string }) => {
        duplicateEmails.add(l.email.toLowerCase());
      });
      console.log(`Found ${globalSentLeads.length} duplicates in global_sent_leads for these advertisers`);
    }

    // Also check injection_leads for backwards compatibility (leads that were sent before global_sent_leads existed)
    console.log('Checking injection_leads for duplicates by advertiser_id...');
    
    const { data: allSentToAdvertisers, error: sentError } = await supabase
      .from('injection_leads')
      .select('email')
      .in('advertiser_id', advertiser_ids)
      .in('status', ['sent', 'failed', 'skipped']);

    if (sentError) {
      console.error('Error fetching sent leads:', sentError);
    } else if (allSentToAdvertisers) {
      allSentToAdvertisers.forEach((l: { email: string }) => {
        duplicateEmails.add(l.email.toLowerCase());
      });
      console.log(`Found ${allSentToAdvertisers.length} duplicates in injection_leads for these advertisers`);
    }

    // Also check lead_distributions for duplicates (live traffic)
    console.log('Checking lead_distributions for duplicates...');
    const poolEmails = poolLeads.map(l => l.email.toLowerCase());
    const batchSize = 500;
    
    for (let i = 0; i < poolEmails.length; i += batchSize) {
      const emailBatch = poolEmails.slice(i, i + batchSize);
      
      // First get lead IDs with these emails
      const { data: matchingLeads } = await supabase
        .from('leads')
        .select('id, email')
        .in('email', emailBatch);

      if (matchingLeads && matchingLeads.length > 0) {
        const leadIds = matchingLeads.map((l: { id: string }) => l.id);
        const emailMap = new Map(matchingLeads.map((l: { id: string; email: string }) => [l.id, l.email]));

        // Check distributions for these leads to these advertisers
        const { data: distributions } = await supabase
          .from('lead_distributions')
          .select('lead_id')
          .in('lead_id', leadIds)
          .in('advertiser_id', advertiser_ids)
          .in('status', ['sent', 'failed']);

        if (distributions) {
          distributions.forEach((d: { lead_id: string }) => {
            const email = emailMap.get(d.lead_id);
            if (email) duplicateEmails.add(email.toLowerCase());
          });
        }
      }
    }

    console.log(`Found ${duplicateEmails.size} duplicate emails`);

    // Step 4: Filter out duplicates AND leads already in current injection
    let eligibleLeads = poolLeads.filter(
      (lead: PoolLead) => 
        !duplicateEmails.has(lead.email.toLowerCase()) && 
        !existingPoolLeadIds.has(lead.id)
    );

    const alreadyInInjectionCount = poolLeads.filter((lead: PoolLead) => existingPoolLeadIds.has(lead.id)).length;
    console.log(`Filtered out ${alreadyInInjectionCount} leads already in current injection`);

    // Step 5: Apply GEO caps if specified
    // This limits how many leads per country can be added
    if (geo_caps && Object.keys(geo_caps).length > 0) {
      console.log('Applying GEO caps:', geo_caps);
      
      // Count how many leads per country already exist in the injection
      const existingCountryCounts: Record<string, number> = {};
      if (injection_id) {
        const { data: existingLeads } = await supabase
          .from('injection_leads')
          .select('country_code')
          .eq('injection_id', injection_id);
        
        if (existingLeads) {
          existingLeads.forEach((l: { country_code: string }) => {
            existingCountryCounts[l.country_code] = (existingCountryCounts[l.country_code] || 0) + 1;
          });
        }
      }
      console.log('Existing country counts in injection:', existingCountryCounts);
      
      // Track how many we've selected per country
      const selectedPerCountry: Record<string, number> = {};
      
      eligibleLeads = eligibleLeads.filter((lead: PoolLead) => {
        const cap = geo_caps[lead.country_code];
        
        // If no cap set for this country, exclude it (only capped countries allowed)
        if (cap === undefined) {
          return false;
        }
        
        // Calculate remaining capacity: cap - already in injection - already selected
        const existingCount = existingCountryCounts[lead.country_code] || 0;
        const selectedCount = selectedPerCountry[lead.country_code] || 0;
        const remainingCapacity = cap - existingCount - selectedCount;
        
        if (remainingCapacity > 0) {
          selectedPerCountry[lead.country_code] = selectedCount + 1;
          return true;
        }
        
        return false;
      });
      
      console.log('After GEO caps applied, selected per country:', selectedPerCountry);
    }

    // Step 6: Apply overall limit if specified
    if (limit && limit > 0 && eligibleLeads.length > limit) {
      eligibleLeads = eligibleLeads.slice(0, limit);
    }

    const duplicateEmailsList = Array.from(duplicateEmails).slice(0, 20); // First 20 for display

    const response: FilterResponse = {
      eligible_leads: eligibleLeads,
      duplicate_count: duplicateEmails.size,
      duplicate_emails: duplicateEmailsList,
      total_pool_leads: poolLeads.length,
    };

    console.log(`Returning ${eligibleLeads.length} eligible leads (${duplicateEmails.size} duplicates filtered)`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in filter-pool-leads:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
