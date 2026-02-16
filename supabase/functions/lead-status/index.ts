import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-key, x-api-key, Api-Key, X-Api-Key',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Check for health check in POST body
    if (req.method === 'POST') {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.health_check === true) {
        return new Response(JSON.stringify({ status: "ok", function: "lead-status" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get API key from header
    const apiKey = req.headers.get('Api-Key') || req.headers.get('api-key') || req.headers.get('X-Api-Key') || req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Api-Key header is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key and get affiliate
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, name')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (affiliateError || !affiliate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get query parameters (support both GET query params and POST body)
    let leadId: string | null = null;
    let requestId: string | null = null;
    let email: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      leadId = url.searchParams.get('lead_id');
      requestId = url.searchParams.get('request_id');
      email = url.searchParams.get('email');
    } else {
      try {
        const body = await req.json();
        leadId = body.lead_id || null;
        requestId = body.request_id || null;
        email = body.email || null;
      } catch {
        // Empty body is okay for GET-style requests
      }
    }

    if (!leadId && !requestId && !email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Must provide lead_id, request_id, or email as query parameter or in body' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query - affiliate can only see their own leads
    let query = supabase
      .from('leads')
      .select(`
        id,
        request_id,
        firstname,
        lastname,
        email,
        mobile,
        country_code,
        status,
        sale_status,
        is_ftd,
        ftd_date,
        ftd_released,
        created_at,
        updated_at,
        distributed_at,
        lead_distributions(
          advertiser_id,
          status,
          sent_at,
          external_lead_id
        )
      `)
      .eq('affiliate_id', affiliate.id);

    if (leadId) {
      query = query.eq('id', leadId);
    } else if (requestId) {
      query = query.eq('request_id', requestId);
    } else if (email) {
      query = query.eq('email', email.toLowerCase());
    }

    const { data: lead, error: leadError } = await query.maybeSingle();

    if (leadError) {
      console.error('Error fetching lead:', leadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lead) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead not found or not owned by this affiliate' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        request_id: lead.request_id,
        status: lead.sale_status || 'New',
        is_ftd: lead.ftd_released ? 1 : 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
