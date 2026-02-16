import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, api-key',
};

interface StatusUpdate {
  lead_id?: string;
  request_id?: string;
  email?: string;
  status?: string;
  is_ftd?: boolean;
  ftd_date?: string;
  message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body first for health check
    const body = await req.json().catch(() => ({}));

    // Health check support
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "advertiser-callback" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from header (advertisers authenticate with their api_key)
    const apiKey = req.headers.get('Api-Key') || req.headers.get('X-Api-Key') || req.headers.get('api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Api-Key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify advertiser by API key
    const { data: advertiser, error: advError } = await supabase
      .from('advertisers')
      .select('id, name')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (advError || !advertiser) {
      console.error('Invalid API key or advertiser not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Body already parsed above for health check
    const statusUpdate = body as StatusUpdate;
    console.log(`Received callback from ${advertiser.name}:`, statusUpdate);

    // Find the lead by various identifiers
    let leadQuery = supabase.from('leads').select('*, affiliates(id, name, callback_url)');
    
    if (statusUpdate.lead_id) {
      leadQuery = leadQuery.eq('id', statusUpdate.lead_id);
    } else if (statusUpdate.request_id) {
      leadQuery = leadQuery.eq('request_id', statusUpdate.request_id);
    } else if (statusUpdate.email) {
      leadQuery = leadQuery.eq('email', statusUpdate.email);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Must provide lead_id, request_id, or email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: lead, error: leadError } = await leadQuery.maybeSingle();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update lead status
    const updates: Record<string, unknown> = {};
    
    if (statusUpdate.status) {
      // Map advertiser status to our status enum
      const statusMap: Record<string, string> = {
        'new': 'new',
        'contacted': 'contacted',
        'qualified': 'qualified',
        'converted': 'converted',
        'ftd': 'converted',
        'deposited': 'converted',
        'lost': 'lost',
        'rejected': 'lost',
      };
      updates.status = statusMap[statusUpdate.status.toLowerCase()] || statusUpdate.status;
    }

    if (statusUpdate.is_ftd !== undefined) {
      updates.is_ftd = statusUpdate.is_ftd;
      if (statusUpdate.is_ftd && !lead.ftd_date) {
        updates.ftd_date = statusUpdate.ftd_date || new Date().toISOString();
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id);

      if (updateError) {
        console.error('Failed to update lead:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update lead' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Updated lead ${lead.id} with:`, updates);
    }

    // Forward to affiliate callback URL if configured
    const affiliate = lead.affiliates as { id: string; name: string; callback_url: string | null } | null;
    
    if (affiliate?.callback_url) {
      const affiliatePayload = {
        lead_id: lead.id,
        request_id: lead.request_id,
        email: lead.email,
        firstname: lead.firstname,
        lastname: lead.lastname,
        status: updates.status || lead.status,
        is_ftd: updates.is_ftd ?? lead.is_ftd,
        ftd_date: updates.ftd_date ?? lead.ftd_date,
        advertiser_message: body.message,
        updated_at: new Date().toISOString(),
      };

      try {
        console.log(`Forwarding to affiliate ${affiliate.name} at ${affiliate.callback_url}`);
        
        const affiliateResponse = await fetch(affiliate.callback_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(affiliatePayload),
        });

        const affiliateResponseText = await affiliateResponse.text();
        console.log(`Affiliate response (${affiliateResponse.status}):`, affiliateResponseText);

        return new Response(
          JSON.stringify({ 
            success: true, 
            lead_id: lead.id,
            updates,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (affiliateError) {
        console.error('Failed to notify affiliate:', affiliateError);
        // Still return success for the status update, but note affiliate notification failed
        return new Response(
          JSON.stringify({ 
            success: true, 
            lead_id: lead.id,
            updates,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        updates,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing callback:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
