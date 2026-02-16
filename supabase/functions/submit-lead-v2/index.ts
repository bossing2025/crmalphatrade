import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "api-key",
    "x-api-version",
    // Supabase client metadata headers (sent by some environments)
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
  ].join(", "),
};

interface LeadData {
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  country_code: string;
  country?: string;
  ip_address?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  offer_name?: string;
  comment?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    lead_id: string;
    request_id: string | null;
  };
  errors?: Record<string, string>;
  api_version: string;
}

const API_VERSION = '2.0';

function createResponse(body: ApiResponse, status: number): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function validateLeadData(body: LeadData): Record<string, string> {
  const errors: Record<string, string> = {};
  
  // Required field validation
  if (!body.firstname?.trim()) errors.firstname = 'First name is required';
  if (!body.lastname?.trim()) errors.lastname = 'Last name is required';
  if (!body.email?.trim()) errors.email = 'Email is required';
  if (!body.mobile?.trim()) errors.mobile = 'Mobile is required';
  if (!body.country_code?.trim()) errors.country_code = 'Country code is required';
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (body.email && !emailRegex.test(body.email.trim())) {
    errors.email = 'Invalid email format';
  }
  
  // Mobile format validation (digits, spaces, dashes, plus, parentheses)
  const mobileRegex = /^[\d\s\-+()]+$/;
  if (body.mobile && !mobileRegex.test(body.mobile)) {
    errors.mobile = 'Invalid mobile format';
  }

  // Country code validation (2-3 letter ISO codes)
  const countryCodeRegex = /^[A-Za-z]{2,3}$/;
  if (body.country_code && !countryCodeRegex.test(body.country_code.trim())) {
    errors.country_code = 'Country code must be 2-3 letter ISO code';
  }

  // Length validations
  if (body.firstname && body.firstname.length > 100) {
    errors.firstname = 'First name must be less than 100 characters';
  }
  if (body.lastname && body.lastname.length > 100) {
    errors.lastname = 'Last name must be less than 100 characters';
  }
  if (body.email && body.email.length > 255) {
    errors.email = 'Email must be less than 255 characters';
  }
  
  return errors;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return createResponse({
      success: false,
      message: 'Method not allowed',
      api_version: API_VERSION,
    }, 405);
  }

  try {
    // Parse request body
    let body: LeadData | { health_check?: boolean };
    try {
      body = await req.json();
    } catch {
      return createResponse({
        success: false,
        message: 'Invalid JSON body',
        api_version: API_VERSION,
      }, 400);
    }

    // Health check support
    if ((body as { health_check?: boolean }).health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "submit-lead-v2" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API key from header
    const apiKey = req.headers.get('Api-Key') || req.headers.get('api-key');
    
    if (!apiKey) {
      return createResponse({
        success: false,
        message: 'API key required. Include Api-Key header.',
        api_version: API_VERSION,
      }, 401);
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key and get affiliate
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, name, is_active')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (affiliateError || !affiliate) {
      return createResponse({
        success: false,
        message: 'Invalid or inactive API key',
        api_version: API_VERSION,
      }, 401);
    }

    // Body already parsed above for health check - cast to LeadData
    const leadData = body as LeadData;
    
    // Validate lead data
    const errors = validateLeadData(leadData);

    if (Object.keys(errors).length > 0) {
      return createResponse({
        success: false,
        message: 'Validation failed',
        errors,
        api_version: API_VERSION,
      }, 422);
    }

    // Check for duplicate email
    const normalizedEmail = leadData.email.trim().toLowerCase();
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingLead) {
      return createResponse({
        success: false,
        message: 'Email already exists',
        errors: { email: 'Duplicate email' },
        api_version: API_VERSION,
      }, 409);
    }

    // Get client IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     leadData.ip_address || 
                     'unknown';

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        firstname: leadData.firstname.trim(),
        lastname: leadData.lastname.trim(),
        email: normalizedEmail,
        mobile: leadData.mobile.replace(/\D+/g, ''), // Strip non-digits
        country_code: leadData.country_code.trim().toUpperCase(),
        country: leadData.country?.trim() || null,
        ip_address: clientIp,
        affiliate_id: affiliate.id,
        custom1: leadData.custom1 || null,
        custom2: leadData.custom2 || null,
        custom3: leadData.custom3 || null,
        offer_name: leadData.offer_name || null,
        comment: leadData.comment || null,
        status: 'new',
      })
      .select('id, request_id')
      .single();

    if (leadError) {
      console.error('Lead creation error:', leadError);
      return createResponse({
        success: false,
        message: 'Failed to create lead',
        errors: { database: leadError.message },
        api_version: API_VERSION,
      }, 500);
    }

    // Distribution is now manual - use distribute-lead endpoint separately

    // Return success response
    return createResponse({
      success: true,
      message: 'Lead submitted successfully',
      data: {
        lead_id: lead.id,
        request_id: lead.request_id,
      },
      api_version: API_VERSION,
    }, 201);

  } catch (error) {
    console.error('Unexpected error:', error);
    return createResponse({
      success: false,
      message: 'An unexpected error occurred',
      api_version: API_VERSION,
    }, 500);
  }
});
