import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-key, x-api-key',
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

interface DistributionSettings {
  advertiser_id: string;
  countries: string[] | null;
  affiliates: string[] | null;
  priority: number | null;
  start_time: string | null;
  end_time: string | null;
  default_daily_cap: number | null;
  default_hourly_cap: number | null;
  is_active: boolean;
  advertisers: {
    id: string;
    name: string;
    is_active: boolean;
    daily_cap: number | null;
    hourly_cap: number | null;
  };
}

interface RejectionReason {
  code: string;
  message: string;
  details?: string;
}

// Validate phone number format and length
function validatePhone(phone: string, countryCode: string): { valid: boolean; error?: string; cleaned?: string } {
  // Remove all non-digits
  let cleaned = phone.replace(/\D+/g, '');
  
  // Check minimum length (at least 7 digits for any valid phone)
  if (cleaned.length < 7) {
    return { valid: false, error: 'Phone number too short (minimum 7 digits)' };
  }
  
  // Check maximum length (15 digits max per E.164)
  if (cleaned.length > 15) {
    return { valid: false, error: 'Phone number too long (maximum 15 digits)' };
  }
  
  // Country-specific validation with prefix stripping
  const countryPhoneRules: Record<string, { minLength: number; maxLength: number; prefix: string }> = {
    'US': { minLength: 10, maxLength: 10, prefix: '1' },
    'UK': { minLength: 10, maxLength: 10, prefix: '44' },
    'GB': { minLength: 10, maxLength: 10, prefix: '44' },
    'DE': { minLength: 10, maxLength: 11, prefix: '49' },
    'FR': { minLength: 9, maxLength: 9, prefix: '33' },
    'AU': { minLength: 9, maxLength: 9, prefix: '61' },
    'CA': { minLength: 10, maxLength: 10, prefix: '1' },
    'IL': { minLength: 9, maxLength: 9, prefix: '972' },
  };
  
  const rules = countryPhoneRules[countryCode.toUpperCase()];
  if (rules) {
    // Strip country prefix if present (e.g., 447793241001 -> 7793241001 for GB)
    let localNumber = cleaned;
    if (cleaned.startsWith(rules.prefix)) {
      localNumber = cleaned.slice(rules.prefix.length);
    }
    
    // Validate local number length
    if (localNumber.length < rules.minLength) {
      return { valid: false, error: `Phone number too short for ${countryCode} (minimum ${rules.minLength} local digits)` };
    }
    if (localNumber.length > rules.maxLength) {
      return { valid: false, error: `Phone number too long for ${countryCode} (maximum ${rules.maxLength} local digits)` };
    }
    
    // Return the original cleaned number (with prefix) for storage
    return { valid: true, cleaned };
  }
  
  return { valid: true, cleaned };
}

// NOTE: We intentionally do NOT pre-check caps/eligibility here.
// The distribution function is the single source of truth for advertiser availability,
// country/affiliate targeting, scheduling, and cap enforcement.

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse body early for health check support
    let body: LeadData | { health_check?: boolean };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid JSON body',
          rejection: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Health check support
    if ((body as { health_check?: boolean }).health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "submit-lead" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API key from header (support multiple header formats)
    const apiKey = req.headers.get('Api-Key') || req.headers.get('api-key') || req.headers.get('X-Api-Key') || req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'API key required',
          rejection: { code: 'AUTH_REQUIRED', message: 'Api-Key header is required' }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key and get affiliate
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, name, is_active, allowed_countries')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (affiliateError || !affiliate) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid or inactive API key',
          rejection: { code: 'INVALID_API_KEY', message: 'API key is invalid or affiliate is inactive' }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Body already parsed above for health check
    const leadData = body as LeadData;
    
    // === STEP 1: Validate required fields ===
    const errors: Record<string, string> = {};
    
    if (!body.firstname?.trim()) errors.firstname = 'First name is required';
    else if (body.firstname.trim().length < 2) errors.firstname = 'First name must be at least 2 characters';
    else if (body.firstname.trim().length > 50) errors.firstname = 'First name must be less than 50 characters';
    
    if (!body.lastname?.trim()) errors.lastname = 'Last name is required';
    else if (body.lastname.trim().length < 2) errors.lastname = 'Last name must be at least 2 characters';
    else if (body.lastname.trim().length > 50) errors.lastname = 'Last name must be less than 50 characters';
    
    if (!body.email?.trim()) errors.email = 'Email is required';
    else if (body.email.trim().length > 255) errors.email = 'Email must be less than 255 characters';
    
    if (!body.mobile?.trim()) errors.mobile = 'Mobile is required';
    
    if (!body.country_code?.trim()) errors.country_code = 'Country code is required';
    else if (body.country_code.trim().length !== 2) errors.country_code = 'Country code must be 2 characters (ISO 3166-1 alpha-2)';

    if (Object.keys(errors).length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Validation failed', 
          errors,
          rejection: { code: 'VALIDATION_FAILED', message: 'Required fields are missing or invalid' }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === STEP 2: Validate email format ===
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(body.email.trim())) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid email format',
          errors: { email: 'Invalid email format' },
          rejection: { code: 'INVALID_EMAIL', message: 'Email address format is invalid' }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for disposable/temporary email domains
    const disposableDomains = ['tempmail.com', 'throwaway.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'yopmail.com'];
    const emailDomain = body.email.trim().split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Disposable email addresses not allowed',
          errors: { email: 'Disposable email not allowed' },
          rejection: { code: 'DISPOSABLE_EMAIL', message: 'Temporary/disposable email addresses are not accepted' }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === STEP 3: Validate phone number ===
    const phoneValidation = validatePhone(body.mobile, body.country_code);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid phone number',
          errors: { mobile: phoneValidation.error },
          rejection: { code: 'INVALID_PHONE', message: phoneValidation.error }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === STEP 4: Check for duplicate email ===
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, created_at')
      .eq('email', body.email.trim().toLowerCase())
      .maybeSingle();

    if (existingLead) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Duplicate email',
          errors: { email: 'Email already exists in the system' },
          rejection: { 
            code: 'DUPLICATE_EMAIL', 
            message: 'A lead with this email address already exists',
            details: `Original lead ID: ${existingLead.id}`
          }
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get cleaned phone for later use
    const cleanedPhone = phoneValidation.cleaned!;
    const normalizedCountryCode = body.country_code.trim().toUpperCase();

    // === STEP 5: Check if affiliate is allowed to send leads from this country ===
    // allowed_countries: null = all countries, [] = none, ['US', 'UK'] = only these
    if (affiliate.allowed_countries !== null) {
      if (!Array.isArray(affiliate.allowed_countries) || affiliate.allowed_countries.length === 0) {
        // Empty array means no countries allowed
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Country '${normalizedCountryCode}' is not allowed for your affiliate account`,
            rejection: { 
              code: 'COUNTRY_NOT_ALLOWED', 
              message: `Your affiliate account is not authorized to send leads from country '${normalizedCountryCode}'`,
              details: 'No countries are configured for this affiliate. Contact support.'
            }
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!affiliate.allowed_countries.includes(normalizedCountryCode)) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Country '${normalizedCountryCode}' is not allowed for your affiliate account`,
            rejection: { 
              code: 'COUNTRY_NOT_ALLOWED', 
              message: `Your affiliate account is not authorized to send leads from country '${normalizedCountryCode}'`,
              details: `Allowed countries: ${affiliate.allowed_countries.join(', ')}`
            }
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // === STEP 6: Get client IP for distribution ===
    // Prefer explicitly provided ip_address from body, then fall back to headers
    const clientIp = body.ip_address?.trim() || 
                     req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // === STEP 7: Try distribution FIRST before creating lead ===
    // Only create the lead if an advertiser accepts it
    let distributionResult = null;
    let distributionSuccess = false;
    
    try {
      // Use distribute-lead with test_mode=true to try distribution first
      // This sends to advertiser and only creates lead on success
      const distributeUrl = `${supabaseUrl}/functions/v1/distribute-lead`;
      const distributeResponse = await fetch(distributeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          test_mode: true,
          test_lead_data: {
            firstname: body.firstname.trim(),
            lastname: body.lastname.trim(),
            email: body.email.trim().toLowerCase(),
            mobile: cleanedPhone,
            country_code: normalizedCountryCode,
            country: body.country?.trim() || null,
            ip_address: clientIp,
            affiliate_id: affiliate.id,
            custom1: body.custom1?.substring(0, 255) || null,
            custom2: body.custom2?.substring(0, 255) || null,
            custom3: body.custom3?.substring(0, 255) || null,
            offer_name: body.offer_name?.substring(0, 100) || null,
            comment: body.comment?.substring(0, 500) || null,
          },
          // Will be picked by eligibility, no specific advertiser_id
        }),
      });
      
      distributionResult = await distributeResponse.json();
      console.log('Distribution-first result:', distributionResult);
      distributionSuccess = distributionResult?.success === true;
    } catch (distError) {
      console.error('Distribution-first error:', distError);
      distributionSuccess = false;
    }

    // === STEP 8: If distribution failed, reject WITHOUT creating lead ===
    if (!distributionSuccess) {
      console.log(`Lead rejected - advertiser did not accept: ${body.email}`);
      
      // Record the rejection in affiliate_submission_failures for tracking
      const rejectionMessage = distributionResult?.advertiser_response || distributionResult?.message || 'Advertiser did not accept this lead';
      try {
        await supabase
          .from('affiliate_submission_failures')
          .insert({
            affiliate_id: affiliate.id,
            email: body.email.trim().toLowerCase(),
            firstname: body.firstname.trim(),
            lastname: body.lastname.trim(),
            mobile: cleanedPhone,
            country_code: normalizedCountryCode,
            rejection_code: 'ADVERTISER_REJECTED',
            rejection_message: rejectionMessage.substring(0, 500),
            raw_payload: body,
          });
        console.log('Recorded advertiser rejection in affiliate_submission_failures');
      } catch (recordErr) {
        console.error('Failed to record rejection:', recordErr);
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Lead rejected by advertiser',
          rejection: { 
            code: 'ADVERTISER_REJECTED', 
            message: rejectionMessage
          }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === STEP 9: Distribution succeeded - lead was already created by distribute-lead ===
    // Return success response with immediate confirmation
    const responseData: Record<string, unknown> = {
      lead_id: distributionResult.lead_id,
      request_id: null, // Will be set by the lead record
    };
    
    // Add autologin URL if present in distribution result
    if (distributionResult?.autologin_url) {
      responseData.autologin_url = distributionResult.autologin_url;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead submitted successfully',
        data: responseData
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'An unexpected error occurred',
        rejection: { code: 'SYSTEM_ERROR', message: 'Internal server error' }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
