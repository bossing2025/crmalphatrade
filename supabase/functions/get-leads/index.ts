import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-key, x-api-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept POST for health check
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.health_check === true) {
        return new Response(JSON.stringify({ status: "ok", function: "get-leads" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // Not a health check, fall through
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const apiKey = req.headers.get('Api-Key') || req.headers.get('api-key') || req.headers.get('X-Api-Key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Api-Key header is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (affiliateError || !affiliate) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');
    const hasFTD = url.searchParams.get('hasFTD');
    const status = url.searchParams.get('status');
    const email = url.searchParams.get('email');
    const leadId = url.searchParams.get('lead_id');
    const includeRejected = url.searchParams.get('includeRejected');

    if (!fromDate || !toDate) {
      return new Response(
        JSON.stringify({ success: false, message: 'fromDate and toDate are required (MM/DD/YY)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse dates (MM/DD/YY format)
    const parseDate = (dateStr: string) => {
      const [month, day, year] = dateStr.split('/');
      return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    const startDate = parseDate(fromDate);
    const endDate = parseDate(toDate);
    endDate.setHours(23, 59, 59, 999);

    // Build query
    let query = supabase
      .from('leads')
      .select('id, request_id, firstname, lastname, email, country_code, mobile, status, sale_status, is_ftd, ftd_date, ftd_released')
      .eq('affiliate_id', affiliate.id)
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    // Exclude rejected by default
    if (includeRejected !== '1') {
      query = query.neq('status', 'rejected');
    }

    // Apply filters
    if (hasFTD === '1') {
      query = query.eq('is_ftd', true);
    } else if (hasFTD === '0') {
      query = query.eq('is_ftd', false);
    }

    if (status) {
      query = query.eq('sale_status', status);
    }

    if (email) {
      query = query.eq('email', email.toLowerCase());
    }

    if (leadId) {
      query = query.eq('id', leadId);
    }

    const { data: leads, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to fetch leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response - affiliates see sale_status from advertiser, FTD only if released
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      lead_code: lead.request_id,
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      country_code: lead.country_code,
      mobile: lead.mobile,
      status: lead.sale_status || 'New',
      sale_status: lead.sale_status || 'New',
      is_ftd: lead.ftd_released ? 1 : 0,
      ftd_date: lead.ftd_released ? lead.ftd_date : null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Leads fetched successfully',
        count: formattedLeads.length,
        data: formattedLeads,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
