import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
  ].join(", "),
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
  distributed_at?: string;
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

interface DistributionSettings {
  advertiser_id: string;
  countries: string[] | null;
  affiliates: string[] | null;
  base_weight: number | null;
  priority: number | null;
  start_time: string | null;
  end_time: string | null;
  default_daily_cap: number | null;
  default_hourly_cap: number | null;
  is_active: boolean;
  weekly_schedule: WeeklySchedule | null;
}

interface DistributionResult {
  success: boolean;
  advertiser_id: string;
  advertiser_name: string;
  external_lead_id?: string;
  autologin_url?: string;
  response?: string;
  error?: string;
}

// Extended adapter result with request metadata for debugging
interface AdapterResult {
  success: boolean;
  response: string;
  requestMetadata?: {
    url: string;
    headers: Record<string, string>;
    payload: string;
  };
}

// Helper to extract external lead ID from response
function extractExternalLeadId(responseText: string): string | null {
  try {
    const data = JSON.parse(responseText);
    // Enigma format: details.leadRequest.ID contains the signupID
    if (data.details?.leadRequest?.ID) {
      return String(data.details.leadRequest.ID);
    }
    // Common patterns for external lead IDs
    return String(data.lead_id || data.leadId || data.id || data.signupId || data.signupID ||
           data.data?.lead_id || data.data?.leadId || data.data?.id || 
           data.data?.signupId || data.data?.signupID ||
           data.leadRequestID || '');
  } catch {
    // If not JSON, try to extract UUID or numeric ID from text
    const uuidMatch = responseText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) return uuidMatch[0];
    
    // Try to extract Enigma-style alphanumeric ID
    const enigmaIdMatch = responseText.match(/"ID":\s*"([a-zA-Z0-9]+)"/);
    if (enigmaIdMatch) return enigmaIdMatch[1];
    
    const numMatch = responseText.match(/"(?:lead_?id|id)":\s*(\d+)/i);
    if (numMatch) return numMatch[1];
    
    return null;
  }
}

// Helper to extract autologin URL from advertiser response
function extractAutologinUrl(responseText: string): string | null {
  try {
    const data = JSON.parse(responseText);
    // Enigma format: details.redirect.url contains the autologin URL
    if (data.details?.redirect?.url) {
      return String(data.details.redirect.url);
    }
    
    // TrackBox/Nolimits format: addonData.data.loginURL or top-level data as URL
    if (data.addonData?.data?.loginURL) {
      return String(data.addonData.data.loginURL);
    }
    
    // TrackBox alternative: top-level "data" field contains the URL directly
    if (data.data && typeof data.data === 'string' && data.data.startsWith('http')) {
      return data.data;
    }
    
    // Common patterns for autologin URLs across different CRMs
    const url = data.autologin_url || data.autologinUrl || data.autoLoginUrl ||
                data.redirect_url || data.redirectUrl || data.login_url || data.loginUrl ||
                data.data?.autologin_url || data.data?.autologinUrl || data.data?.autoLoginUrl ||
                data.data?.redirect_url || data.data?.redirectUrl || data.data?.login_url || 
                data.data?.loginUrl || data.data?.loginURL || data.url || data.data?.url || null;
    
    // Validate it looks like a URL
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
    return null;
  } catch {
    // Try regex extraction for URL patterns in non-JSON responses
    const urlMatch = responseText.match(/"(?:autologin_?url|redirect_?url|login_?url|loginURL|url)":\s*"(https?:\/\/[^"]+)"/i);
    if (urlMatch) return urlMatch[1];
    return null;
  }
}

// VPS forwarder URL - routes through static IP 63.250.32.170 (uses main domain path)
const FORWARDER_URL = 'https://crm.alphatradecrm.com/proxy/forward.php';

// Helper to handle forwarder response with diagnostic fallback
async function handleForwarderResponse(response: Response, advertiserName: string): Promise<string> {
  const textRaw = await response.text();
  const status = response.status;
  console.log(`${advertiserName} forwarder status:`, status);
  
  // If empty response, return diagnostic JSON
  if (!(textRaw || '').trim()) {
    return JSON.stringify({
      message: 'Empty response body from forwarder/CRM',
      forwarder_status: status,
    });
  }
  return textRaw;
}

// Advertiser API Adapters - ALL route through VPS forwarder for IP whitelisting
const advertiserAdapters: Record<string, (lead: Lead, advertiser: Advertiser) => Promise<AdapterResult>> = {

  // TrackBox API format
  // Docs: https://intercom.help/tigloo/en/articles/9349579-trackbox-api-documentation
  trackbox: async (lead, advertiser) => {
    // Config should contain: username, password, ai, ci, gi, api_key_post, api_key_get
    const config = advertiser.config || {};
    
    // Generate a random password for the lead's account
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password + 'Aa1!'; // Ensure it meets password requirements
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

    // Add MPC params if provided
    if (lead.custom2) payload.MPC_1 = lead.custom2;
    if (lead.custom3) payload.MPC_2 = lead.custom3;

    // Use api_key_post from config for POST requests
    const apiKeyPost = String(config.api_key_post || advertiser.api_key || '');

    // Build headers for TrackBox
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-trackbox-username': String(config.username || ''),
      'x-trackbox-password': String(config.password || ''),
      'x-api-key': apiKeyPost,
    };

    // Capture request metadata for debugging
    const requestMetadata = {
      url: advertiser.url,
      headers: headers,
      payload: JSON.stringify(payload),
    };

    console.log('TrackBox target URL:', advertiser.url);
    // TrackBox requires custom headers (x-trackbox-username, x-trackbox-password, x-api-key)
    // that don't survive the VPS forwarder proxy. Send directly.
    console.log('TrackBox: sending direct request (custom headers not compatible with forwarder)');

    const response = await fetch(advertiser.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    console.log('TrackBox response status:', response.status);
    console.log('TrackBox response:', text);
    
    // Check TrackBox JSON response for actual success (status: true)
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      // TrackBox returns { status: true/false, ... }
      if (json.status === false) {
        isSuccess = false;
      }
    } catch {
      // Not JSON, fall back to HTTP status
    }
    return { success: isSuccess, response: text, requestMetadata };
  },

  // Dr Tracker (DrMailer) API format
  // Docs: https://tracker.doctor-mailer.com/help/#api_integration
  drmailer: async (lead, advertiser) => {
    // Config should contain: pass, campaign_id
    const config = advertiser.config || {};
    
    // Build form-urlencoded payload
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

    console.log('DrMailer target URL:', apiUrl);
    console.log('DrMailer routing through VPS forwarder:', FORWARDER_URL);

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Target-Url': apiUrl,
        'X-Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const text = await handleForwarderResponse(response, 'DrMailer');
    console.log('DrMailer response:', text);
    
    // Check response for success indicators
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      if (json.status === 'error' || json.error) {
        isSuccess = false;
      }
    } catch {
      // Not JSON, check for common error patterns
      if (text.toLowerCase().includes('error')) {
        isSuccess = false;
      }
    }
    
    return { success: isSuccess, response: text };
  },

  // Getlinked / FTD Kitchen API format
  // Uses application/x-www-form-urlencoded with Api-Key header
  // Routes through VPS proxy for static IP whitelisting
  enigma: async (lead, advertiser) => {
    const config = advertiser.config || {};
    
    // Generate a password: 1 lowercase, 1 uppercase, 1 number, NO special characters
    const generatePassword = () => {
      const lower = 'abcdefghijklmnopqrstuvwxyz';
      const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const digits = '0123456789';
      const all = lower + upper + digits;
      
      // Start with required characters
      let password = '';
      password += upper.charAt(Math.floor(Math.random() * upper.length));
      password += lower.charAt(Math.floor(Math.random() * lower.length));
      password += digits.charAt(Math.floor(Math.random() * digits.length));
      
      // Add 7 more random characters (total 10 chars)
      for (let i = 0; i < 7; i++) {
        password += all.charAt(Math.floor(Math.random() * all.length));
      }
      return password;
    };

    // Normalize phone: digits-only
    const phoneDigitsRaw = (lead.mobile || '').replace(/\D/g, '');

    // Country code prefix lookup for GetLinked/Enigma (requires full phone with country prefix)
    const countryPrefixes: Record<string, string> = {
      'GT': '502', 'US': '1', 'CA': '1', 'MX': '52', 'BR': '55', 'AR': '54', 'CL': '56',
      'CO': '57', 'PE': '51', 'VE': '58', 'EC': '593', 'UY': '598', 'PY': '595', 'BO': '591',
      'CR': '506', 'PA': '507', 'SV': '503', 'HN': '504', 'NI': '505', 'DO': '1809',
      'GB': '44', 'DE': '49', 'FR': '33', 'ES': '34', 'IT': '39', 'NL': '31', 'BE': '32',
      'AT': '43', 'CH': '41', 'PT': '351', 'PL': '48', 'SE': '46', 'NO': '47', 'DK': '45',
      'FI': '358', 'IE': '353', 'CZ': '420', 'GR': '30', 'HU': '36', 'RO': '40', 'UA': '380',
      'AU': '61', 'NZ': '64', 'JP': '81', 'KR': '82', 'CN': '86', 'IN': '91', 'PH': '63',
      'TH': '66', 'VN': '84', 'ID': '62', 'MY': '60', 'SG': '65', 'HK': '852', 'TW': '886',
      'AE': '971', 'SA': '966', 'IL': '972', 'TR': '90', 'EG': '20', 'ZA': '27', 'NG': '234',
      'KE': '254', 'GH': '233', 'MA': '212', 'TN': '216', 'DZ': '213',
    };

    // Build phone with country prefix if not already present, then add + for E.164
    let phoneForEnigma = phoneDigitsRaw;
    const countryPrefix = countryPrefixes[lead.country_code?.toUpperCase()] || '';
    if (countryPrefix && !phoneDigitsRaw.startsWith(countryPrefix)) {
      phoneForEnigma = countryPrefix + phoneDigitsRaw;
    }
    // Add + prefix for E.164 format (GetLinked requires this)
    // Some CRMs (e.g., Swiss Capital) don't want the + prefix
    const skipPhonePlus = config.skip_phone_plus === true;
    if (!skipPhonePlus) {
      phoneForEnigma = '+' + phoneForEnigma;
    }

    // Build form-urlencoded payload for Enigma / GetLinked
    const params = new URLSearchParams();
    params.append('email', lead.email);
    params.append('firstName', lead.firstname);
    params.append('lastName', lead.lastname);
    params.append('password', generatePassword());
    params.append('ip', lead.ip_address || '1.1.1.1');
    params.append('phone', phoneForEnigma);
    
    // Optional parameters
    if (lead.custom1) params.append('custom1', lead.custom1);
    if (lead.custom2) params.append('custom2', lead.custom2);
    if (lead.custom3) params.append('custom3', lead.custom3);
    if (lead.comment) params.append('comment', lead.comment);

    // Only send offerName/offerWebsite PARAMS if the advertiser actually needs them
    // Some Enigma CRMs (e.g., Swiss Capital) don't use offers at all
    const sendOfferFields = config.send_offer_fields !== false; // default true for backward compat, set false to disable
    
    // Determine offerWebsite/Referer value independently (needed for forwarder Referer header even if not sent as param)
    let offerWebsite = '';
    const leadOfferName = lead.offer_name || '';
    if (leadOfferName.includes('.') && (leadOfferName.startsWith('http') || leadOfferName.startsWith('www'))) {
      offerWebsite = leadOfferName.startsWith('http') ? leadOfferName : `https://${leadOfferName}`;
    } else if (leadOfferName) {
      // Non-URL offer name (e.g. campaign name) - pass as-is for CRM matching
      offerWebsite = leadOfferName;
    } else if (config.offer_website) {
      offerWebsite = String(config.offer_website);
      if (!offerWebsite.startsWith('http') && offerWebsite.includes('.')) {
        offerWebsite = `https://${offerWebsite}`;
      }
    }

    if (sendOfferFields) {
      if (lead.offer_name) params.append('offerName', lead.offer_name);
      if (offerWebsite) {
        params.append('offerWebsite', offerWebsite);
      }
    }

    // Log both the payload and a cURL command for easy debugging
    const payloadStr = params.toString();
    console.log('Enigma payload:', payloadStr);
    console.log('Enigma target URL:', advertiser.url);
    console.log('Enigma offer_website:', offerWebsite);

    // Check if direct call is requested (bypasses VPS forwarder)
    const useDirectCall = config.direct_call === true;
    
    if (useDirectCall) {
      // Direct call - no VPS forwarder
      console.log('Enigma using DIRECT call (no forwarder)');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Api-Key': advertiser.api_key,
      };

      const response = await fetch(advertiser.url, {
        method: 'POST',
        headers,
        body: params.toString(),
      });

      const text = await response.text();
      console.log('Enigma direct status:', response.status);
      console.log('Enigma direct response:', text);
      
      // Check for success - Enigma uses code 0 for success
      let isSuccess = response.ok;
      try {
        const json = JSON.parse(text);
        if (json.code !== undefined && json.code !== 0) {
          isSuccess = false;
        }
        if (json.success === false || json.error) {
          isSuccess = false;
        }
      } catch {
        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('invalid')) {
          isSuccess = false;
        }
      }
      
      return { success: isSuccess, response: text };
    }

    // VPS forwarder path
    console.log('Enigma routing through VPS forwarder:', FORWARDER_URL);

    // Build headers - include Referer headers for GetLinked compatibility (unless disabled)
    const authHeaderName = config.auth_header_name || 'Api-Key';
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Target-Url': advertiser.url,
      [authHeaderName]: advertiser.api_key,
    };

    // Add Referer headers if offer_website is available and not disabled
    // The forwarder will pass X-Custom-Referer as Referer to the target
    // Some advertisers (e.g., RevDale) explicitly request no Referer headers
    const skipReferer = config.skip_referer_header === true;
    if (offerWebsite && !skipReferer) {
      headers['Referer'] = offerWebsite;
      headers['X-Forwarded-Referer'] = offerWebsite;
      headers['X-Custom-Referer'] = offerWebsite;
    }

    // Route through VPS forwarder for static IP
    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    const textRaw = await response.text();
    const status = response.status;
    const headersObj = Object.fromEntries(response.headers.entries());
    console.log('Enigma forwarder status:', status);
    console.log('Enigma forwarder headers:', headersObj);

    // Some CRMs/forwarders may return an empty body on success; store a diagnostic payload
    // so the UI doesn't show a blank response.
    const text = (textRaw || '').trim()
      ? textRaw
      : JSON.stringify({
          message: 'Empty response body from forwarder/CRM',
          forwarder_status: status,
          forwarder_headers: headersObj,
        });
    console.log('Enigma response:', text);
    
    // Check for success - Enigma uses code 0 for success
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      // Enigma returns code 0 for success, any other code is an error
      if (json.code !== undefined && json.code !== 0) {
        isSuccess = false;
      }
      if (json.success === false || json.error) {
        isSuccess = false;
      }
    } catch {
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('invalid')) {
        isSuccess = false;
      }
    }
    
    return { success: isSuccess, response: text };
  },

  // Timelocal API format (JSON with Api-Key header)
  timelocal: async (lead, advertiser) => {
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

    console.log('Timelocal target URL:', advertiser.url);
    console.log('Timelocal routing through VPS forwarder:', FORWARDER_URL);

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-Url': advertiser.url,
        'X-Api-Key': advertiser.api_key,
        'X-Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await handleForwarderResponse(response, 'Timelocal');
    console.log('Timelocal response:', text);
    return { success: response.ok, response: text };
  },

  // EliteCRM API format (Egoli Trading)
  // Docs: https://trade.egolitrading.online/affiliate-docs
  // Uses JSON with Api-Key header, requires sender param and country name
  elitecrm: async (lead, advertiser) => {
    const config = advertiser.config || {};
    
    const payload: Record<string, string> = {
      sender: String(config.sender || ''),
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      mobile: lead.mobile,
      country_code: lead.country_code,
      ip_address: lead.ip_address || '1.1.1.1',
      country: lead.country || '',
    };

    // Optional fields
    if (lead.offer_name) payload.offerName = lead.offer_name;
    if (lead.custom1) payload.custom1 = lead.custom1;
    if (lead.custom2) payload.custom2 = lead.custom2;
    if (lead.custom3) payload.custom3 = lead.custom3;
    if (lead.comment) payload.comment = lead.comment;

    const targetUrl = advertiser.url;
    console.log('EliteCRM target URL:', targetUrl);
    console.log('EliteCRM payload:', JSON.stringify(payload));

    // Try direct call first (EliteCRM may not require IP whitelisting)
    // If it fails, we can switch to forwarder
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': advertiser.api_key,
      },
      body: JSON.stringify(payload),
    });

    const text = await handleForwarderResponse(response, 'EliteCRM');
    console.log('EliteCRM response:', text);
    
    // Check for success
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      if (json.success === false || json.error) {
        isSuccess = false;
      }
    } catch {
      if (text.toLowerCase().includes('error')) {
        isSuccess = false;
      }
    }
    
    return { success: isSuccess, response: text };
  },

  // GSI Markets API format (PHP-based with id/hash URL params)
  // Uses application/x-www-form-urlencoded with action params in the body
  // GSI expects: act, id, hash in form body, NOT in URL query params
  gsi: async (lead, advertiser) => {
    const config = advertiser.config || {};
    const gsiId = String(config.gsi_id || '');
    const gsiHash = String(config.gsi_hash || '');
    
    // GSI auth params go in form body, not URL
    
    // Build form-urlencoded payload - include act, id, hash as form params
    const params = new URLSearchParams();
    // GSI authentication/action params
    params.append('act', 'register');
    params.append('id', gsiId);
    params.append('hash', gsiHash);
    // Lead data
    params.append('firstname', lead.firstname);
    params.append('lastname', lead.lastname);
    params.append('email', lead.email);
    params.append('phone', lead.mobile);
    params.append('country', lead.country_code);
    params.append('ip', lead.ip_address || '0.0.0.0');
    
    // Optional fields
    if (lead.offer_name) params.append('campaign', lead.offer_name);
    if (lead.custom1) params.append('custom1', lead.custom1);
    if (lead.custom2) params.append('custom2', lead.custom2);
    if (lead.custom3) params.append('custom3', lead.custom3);
    if (lead.comment) params.append('comment', lead.comment);

    const targetUrl = advertiser.url || 'https://www.gsimarkets.com/api_add2.php';
    
    console.log('GSI target URL:', targetUrl);
    console.log('GSI payload:', params.toString());
    console.log('GSI routing through VPS forwarder:', FORWARDER_URL);
    
    // Route through VPS forwarder for static IP whitelisting
    // Forwarder requires non-empty X-Api-Key header to parse X-Target-Url
    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Target-Url': targetUrl,
        'X-Api-Key': 'vps_fixed', // Required by forwarder (non-empty value)
      },
      body: params.toString(),
    });

    const text = await handleForwarderResponse(response, 'GSI');
    console.log('GSI forwarder status:', response.status);
    console.log('GSI response:', text);
    
    // Check response for success indicators
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      // Check for common error patterns
      if (json.status === 'error' || json.error || json.success === false) {
        isSuccess = false;
      }
      // GSI may use code-based responses
      if (json.code !== undefined && json.code !== 0 && json.code !== '0') {
        isSuccess = false;
      }
    } catch {
      // Not JSON, check for common error patterns
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('invalid')) {
        isSuccess = false;
      }
    }
    
    return { success: isSuccess, response: text };
  },

  // ELNOPY / Mpower Traffic API format
  // Uses form-urlencoded with API token in query string
  // Phone must be E.164 format with plus sign
  elnopy: async (lead, advertiser) => {
    const config = advertiser.config || {};
    const apiToken = String(config.api_token || advertiser.api_key || '');
    const linkId = String(config.link_id || '');
    
    // Country code prefix lookup for E.164 format
    const countryPrefixes: Record<string, string> = {
      'GT': '502', 'US': '1', 'CA': '1', 'MX': '52', 'BR': '55', 'AR': '54', 'CL': '56',
      'CO': '57', 'PE': '51', 'VE': '58', 'EC': '593', 'UY': '598', 'PY': '595', 'BO': '591',
      'CR': '506', 'PA': '507', 'SV': '503', 'HN': '504', 'NI': '505', 'DO': '1809',
      'GB': '44', 'DE': '49', 'FR': '33', 'ES': '34', 'IT': '39', 'NL': '31', 'BE': '32',
      'AT': '43', 'CH': '41', 'PT': '351', 'PL': '48', 'SE': '46', 'NO': '47', 'DK': '45',
      'FI': '358', 'IE': '353', 'CZ': '420', 'GR': '30', 'HU': '36', 'RO': '40', 'UA': '380',
      'AU': '61', 'NZ': '64', 'JP': '81', 'KR': '82', 'CN': '86', 'IN': '91', 'PH': '63',
      'TH': '66', 'VN': '84', 'ID': '62', 'MY': '60', 'SG': '65', 'HK': '852', 'TW': '886',
      'AE': '971', 'SA': '966', 'IL': '972', 'TR': '90', 'EG': '20', 'ZA': '27', 'NG': '234',
      'KE': '254', 'GH': '233', 'MA': '212', 'TN': '216', 'DZ': '213',
    };

    // Build E.164 phone with plus sign
    const phoneDigits = (lead.mobile || '').replace(/\D/g, '');
    const countryPrefix = countryPrefixes[lead.country_code?.toUpperCase()] || '';
    let fullphone = phoneDigits;
    if (countryPrefix && !phoneDigits.startsWith(countryPrefix)) {
      fullphone = countryPrefix + phoneDigits;
    }
    fullphone = '+' + fullphone; // E.164 requires plus sign

    // Build form-urlencoded payload
    const params = new URLSearchParams();
    params.append('fname', lead.firstname);
    params.append('lname', lead.lastname);
    params.append('email', lead.email);
    params.append('fullphone', fullphone);
    params.append('ip', lead.ip_address || '0.0.0.0');
    params.append('country', lead.country_code?.toUpperCase() || '');
    params.append('link_id', linkId);
    
    // Optional fields
    if (lead.offer_name) params.append('funnel', lead.offer_name);
    if (config.source) params.append('source', String(config.source));
    if (lead.custom1) params.append('click_id', lead.custom1);
    if (lead.custom2) params.append('utm_source', lead.custom2);
    if (lead.custom3) params.append('utm_campaign', lead.custom3);
    if (lead.comment) params.append('description', lead.comment);

    // Build target URL with API token in query string
    const baseUrl = advertiser.url || 'https://tracking.mpowertraffic2.com/api/v3/integration';
    const targetUrl = `${baseUrl}?api_token=${encodeURIComponent(apiToken)}`;

    console.log('ELNOPY target URL:', targetUrl);
    console.log('ELNOPY payload:', params.toString());
    console.log('ELNOPY routing through VPS forwarder:', FORWARDER_URL);

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Target-Url': targetUrl,
        'X-Api-Key': 'vps_fixed', // Required by forwarder (non-empty value)
        'X-Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const text = await handleForwarderResponse(response, 'ELNOPY');
    console.log('ELNOPY response:', text);

    // Check response for success
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      // ELNOPY returns { success: true/false, ... }
      if (json.success === false || json.success === 'false') {
        isSuccess = false;
      }
      if (json.success === true || json.success === 'true') {
        isSuccess = true;
      }
    } catch {
      // Not JSON, check for error patterns
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('not valid')) {
        isSuccess = false;
      }
    }

    return { success: isSuccess, response: text };
  },

  // Alias: getlinked uses the same logic as enigma
  getlinked: async (lead, advertiser) => {
    return advertiserAdapters.enigma(lead, advertiser);
  },

  // Custom/AI-generated integration - uses dynamic config from advertiser_integration_configs
  custom: async (lead, advertiser) => {
    console.log(`Custom adapter for ${advertiser.name} - fetching integration config...`);
    
    // The integration config should be passed via advertiser.config.integration_config
    // This will be set by the caller after fetching from advertiser_integration_configs
    const integrationConfig = advertiser.config?.integration_config as {
      endpoint_url: string;
      http_method: string;
      content_type: string;
      auth_type: string;
      auth_header_name: string;
      field_mappings: Record<string, string>;
      success_indicators: Array<{ path: string; value: string | number | boolean }>;
      error_indicators: Array<{ path: string; value: string | number | boolean }>;
      lead_id_path?: string;
      autologin_url_path?: string;
    } | undefined;

    if (!integrationConfig) {
      console.error('No integration config found for custom advertiser');
      return { 
        success: false, 
        response: JSON.stringify({ error: 'No integration configuration found for this advertiser' }) 
      };
    }

    // Build payload from field mappings
    const payload: Record<string, string> = {};
    const leadData: Record<string, string> = {
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      mobile: lead.mobile,
      country_code: lead.country_code,
      ip_address: lead.ip_address || '',
      offer_name: lead.offer_name || '',
      custom1: lead.custom1 || '',
      custom2: lead.custom2 || '',
      custom3: lead.custom3 || '',
    };

    for (const [ourField, theirField] of Object.entries(integrationConfig.field_mappings)) {
      if (leadData[ourField] !== undefined && theirField) {
        payload[theirField] = leadData[ourField];
      }
    }

    console.log(`Custom adapter payload for ${advertiser.name}:`, payload);
    console.log('Target URL:', integrationConfig.endpoint_url);

    // Build headers based on auth type
    const headers: Record<string, string> = {
      'Content-Type': integrationConfig.content_type === 'application/x-www-form-urlencoded' 
        ? 'application/x-www-form-urlencoded' 
        : 'application/json',
      'X-Target-Url': integrationConfig.endpoint_url,
      'X-Content-Type': integrationConfig.content_type || 'application/json',
    };

    // Add authentication header based on auth type
    if (integrationConfig.auth_type !== 'none') {
      if (integrationConfig.auth_type === 'bearer' && advertiser.api_key) {
        headers['X-Authorization'] = `Bearer ${advertiser.api_key}`;
      } else if (integrationConfig.auth_type === 'basic') {
        // Basic auth uses username:password from advertiser config
        const config = advertiser.config || {};
        const username = String(config.username || '');
        const password = String(config.password || '');
        if (username && password) {
          headers['X-Auth-Username'] = username;
          headers['X-Auth-Password'] = password;
        }
      } else if (advertiser.api_key) {
        // api_key or custom_header
        headers['X-Api-Key'] = advertiser.api_key;
        if (integrationConfig.auth_header_name && integrationConfig.auth_header_name !== 'Api-Key') {
          headers['X-Auth-Header-Name'] = integrationConfig.auth_header_name;
        }
      }
    }

    // Format body based on content type
    let body: string;
    if (integrationConfig.content_type === 'application/x-www-form-urlencoded') {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        params.append(key, value);
      }
      body = params.toString();
    } else {
      body = JSON.stringify(payload);
    }

    console.log(`Custom adapter routing through VPS forwarder:`, FORWARDER_URL);

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers,
      body,
    });

    const text = await handleForwarderResponse(response, `Custom (${advertiser.name})`);
    console.log(`Custom adapter response for ${advertiser.name}:`, text);

    // Parse response and check success/error indicators
    let isSuccess = response.ok;
    try {
      const jsonResponse = JSON.parse(text);
      
      // Check error indicators first
      for (const indicator of integrationConfig.error_indicators || []) {
        const value = getValueByPath(jsonResponse, indicator.path);
        if (value === indicator.value) {
          console.log(`Custom adapter: Error indicator matched - ${indicator.path} = ${indicator.value}`);
          isSuccess = false;
          break;
        }
      }

      // Then check success indicators (if we haven't found an error)
      if (isSuccess && (integrationConfig.success_indicators || []).length > 0) {
        let foundSuccess = false;
        for (const indicator of integrationConfig.success_indicators) {
          const value = getValueByPath(jsonResponse, indicator.path);
          if (value === indicator.value) {
            console.log(`Custom adapter: Success indicator matched - ${indicator.path} = ${indicator.value}`);
            foundSuccess = true;
            break;
          }
        }
        if (!foundSuccess) {
          console.log('Custom adapter: No success indicators matched');
          isSuccess = false;
        }
      }
    } catch {
      // Not JSON - check for common error patterns in text
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
        isSuccess = false;
      }
    }

    return { success: isSuccess, response: text };
  },

  // Mock advertiser - always succeeds, used for testing affiliate integrations
  mock: async (lead, _advertiser) => {
    console.log('Mock adapter invoked for testing - always returns success');
    
    // Generate a fake lead ID and autologin URL for testing purposes
    const mockLeadId = 'MOCK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const mockAutologinUrl = `https://mock-crm.example.com/autologin?lead_id=${mockLeadId}&email=${encodeURIComponent(lead.email)}`;
    
    const mockResponse = {
      success: true,
      message: 'Test lead accepted by Mock Advertiser',
      lead_id: mockLeadId,
      autologin_url: mockAutologinUrl,
      data: {
        id: mockLeadId,
        email: lead.email,
        firstname: lead.firstname,
        lastname: lead.lastname,
        country_code: lead.country_code,
        received_at: new Date().toISOString(),
      }
    };
    
    console.log('Mock adapter response:', JSON.stringify(mockResponse));
    return { success: true, response: JSON.stringify(mockResponse) };
  },
};

// Helper to get value from nested object by dot-notation path
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

interface EligibleAdvertiser extends Advertiser {
  weight: number;
  priority_type: 'primary' | 'fallback';
}

interface EligibleAdvertisersResult {
  primary: EligibleAdvertiser[];
  fallback: EligibleAdvertiser[];
}

// Helper to get advertisers that previously rejected this email
// deno-lint-ignore no-explicit-any
async function getPriorRejections(supabase: any, email: string): Promise<Set<string>> {
  const { data: rejections } = await supabase
    .from('advertiser_email_rejections')
    .select('advertiser_id')
    .eq('email', email.toLowerCase());
  
  const rejectedAdvertiserIds = new Set<string>();
  if (rejections) {
    for (const r of rejections) {
      rejectedAdvertiserIds.add(r.advertiser_id);
    }
  }
  return rejectedAdvertiserIds;
}

// Helper to record a new email rejection by an advertiser
// deno-lint-ignore no-explicit-any
async function recordEmailRejection(supabase: any, email: string, advertiserId: string, reason: string): Promise<void> {
  try {
    await supabase
      .from('advertiser_email_rejections')
      .upsert({
        email: email.toLowerCase(),
        advertiser_id: advertiserId,
        rejection_reason: reason.substring(0, 500),
      }, { onConflict: 'email,advertiser_id' });
    console.log(`Recorded email rejection: ${email} by advertiser ${advertiserId}`);
  } catch (err) {
    console.error('Failed to record email rejection:', err);
  }
}

// Helper to parse a human-readable rejection reason from advertiser response
function parseRejectionReason(response: string): string {
  try {
    const data = JSON.parse(response);
    
    // Common patterns for rejection messages
    // Pattern 1: { errors: [{ message: "..." }] }
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const errorMessages = data.errors.map((e: { message?: string }) => e.message || '').filter(Boolean);
      if (errorMessages.length > 0) {
        return errorMessages.join('; ');
      }
    }
    
    // Pattern 2: { error: "..." } or { error: { message: "..." } }
    if (data.error) {
      if (typeof data.error === 'string') return data.error;
      if (data.error.message) return data.error.message;
    }
    
    // Pattern 3: { message: "..." }
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }
    
    // Pattern 4: { msg: "..." }
    if (data.msg && typeof data.msg === 'string') {
      return data.msg;
    }
    
    // Pattern 5: { description: "..." }
    if (data.description && typeof data.description === 'string') {
      return data.description;
    }
    
    // Pattern 6: { reason: "..." }
    if (data.reason && typeof data.reason === 'string') {
      return data.reason;
    }
    
    // If JSON but no recognized pattern, return first 200 chars of original
    return response.substring(0, 200);
  } catch {
    // Not JSON, return as-is (truncated)
    return response.substring(0, 200);
  }
}

// deno-lint-ignore no-explicit-any
async function getEligibleAdvertisers(supabase: any, lead: Lead): Promise<EligibleAdvertisersResult> {
  const result: EligibleAdvertisersResult = { primary: [], fallback: [] };
  
  // FIRST: Check if affiliate is in test_mode - bypass all rules and route to Mock Advertiser
  if (lead.affiliate_id) {
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('test_mode')
      .eq('id', lead.affiliate_id)
      .single();
    
    if (affiliate?.test_mode === true) {
      console.log(`Affiliate ${lead.affiliate_id} is in TEST MODE - routing to Mock Advertiser`);
      
      // Get Mock Advertiser
      const { data: mockAdvertiser } = await supabase
        .from('advertisers')
        .select('*')
        .eq('advertiser_type', 'mock')
        .eq('is_active', true)
        .limit(1)
        .single();
      
      if (mockAdvertiser) {
        const eligibleMock: EligibleAdvertiser = {
          ...mockAdvertiser as Advertiser,
          weight: 100,
          priority_type: 'primary',
        };
        result.primary.push(eligibleMock);
        console.log(`Test mode: Mock Advertiser found and added as primary`);
        return result;
      } else {
        console.log('Test mode: No Mock Advertiser found - falling back to normal rules');
      }
    }
  }
  
  // Get advertisers that previously rejected this email
  const priorRejections = await getPriorRejections(supabase, lead.email);
  if (priorRejections.size > 0) {
    console.log(`Email ${lead.email} was previously rejected by ${priorRejections.size} advertiser(s)`);
  }
  // Check if there are affiliate-specific distribution rules
  if (lead.affiliate_id) {
    const { data: affiliateRules } = await supabase
      .from('affiliate_distribution_rules')
      .select('*')
      .eq('affiliate_id', lead.affiliate_id)
      .eq('country_code', lead.country_code)
      .eq('is_active', true);

    if (affiliateRules && affiliateRules.length > 0) {
      console.log(`Found ${affiliateRules.length} affiliate distribution rules for ${lead.affiliate_id} + ${lead.country_code}`);
      
      // Get the advertisers from the rules
      const advertiserIds = affiliateRules.map((r: any) => r.advertiser_id);
      const { data: advertisers } = await supabase
        .from('advertisers')
        .select('*')
        .in('id', advertiserIds)
        .eq('is_active', true);

      if (!advertisers?.length) {
        console.log('No active advertisers found from affiliate rules');
        return result;
      }

      // Get distribution counts for cap checking
      // IMPORTANT: affiliate_distribution_rules caps are per affiliate + country + advertiser.
      // Do NOT use global advertiser counts here.
      const today = new Date().toISOString().split('T')[0];
      const { data: todayDistributions } = await supabase
        .from('lead_distributions')
        // Join to leads so we can filter by affiliate_id + country_code
        .select('advertiser_id, leads!inner(country_code, affiliate_id)')
        .in('advertiser_id', advertiserIds)
        .gte('created_at', `${today}T00:00:00Z`)
        .eq('status', 'sent')
        .eq('leads.country_code', lead.country_code)
        .eq('leads.affiliate_id', lead.affiliate_id);

      const dailyCounts = new Map<string, number>();
      if (todayDistributions) {
        for (const d of todayDistributions as any[]) {
          dailyCounts.set(d.advertiser_id, (dailyCounts.get(d.advertiser_id) || 0) + 1);
        }
      }

      // Get hourly distribution counts (same scope: affiliate + country + advertiser)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: hourlyDistributions } = await supabase
        .from('lead_distributions')
        .select('advertiser_id, leads!inner(country_code, affiliate_id)')
        .in('advertiser_id', advertiserIds)
        .gte('created_at', hourAgo)
        .eq('status', 'sent')
        .eq('leads.country_code', lead.country_code)
        .eq('leads.affiliate_id', lead.affiliate_id);

      const hourlyCounts = new Map<string, number>();
      if (hourlyDistributions) {
        for (const d of hourlyDistributions as any[]) {
          hourlyCounts.set(d.advertiser_id, (hourlyCounts.get(d.advertiser_id) || 0) + 1);
        }
      }

      // Filter advertisers based on rule caps
      const rulesMap = new Map<string, any>();
      for (const rule of affiliateRules) {
        rulesMap.set(rule.advertiser_id, rule);
      }

      // Helper to get current time in a specific timezone
      const getTimeInTimezone = (tz: string): { day: keyof WeeklySchedule; time: string } => {
        const now = new Date();
        const days: (keyof WeeklySchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        try {
          // Use Intl.DateTimeFormat to get time in the specified timezone
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
          // Fallback to UTC if timezone is invalid
          return {
            day: days[now.getUTCDay()],
            time: `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`
          };
        }
      };

      for (const advRaw of advertisers) {
        const adv = advRaw as Advertiser;
        const rule = rulesMap.get(adv.id);
        if (!rule) continue;

        // Check if this advertiser previously rejected this email
        if (priorRejections.has(adv.id)) {
          console.log(`${adv.name}: Previously rejected this email`);
          continue;
        }

        // Get current time in the rule's timezone (default to UTC)
        const ruleTimezone = rule.timezone || 'UTC';
        const { day: currentDay, time: currentTimeStr } = getTimeInTimezone(ruleTimezone);

        // Check working hours from rule
        if (rule.weekly_schedule) {
          console.log(`${adv.name}: Checking weekly schedule in ${ruleTimezone} (${currentDay} ${currentTimeStr})`);
          // Advanced weekly schedule - check day and time
          const daySchedule = rule.weekly_schedule[currentDay];
          if (!daySchedule?.is_active) {
            console.log(`${adv.name}: Day ${currentDay} is not active in weekly schedule`);
            continue;
          }
          if (daySchedule.start_time && daySchedule.end_time) {
            const startTime = daySchedule.start_time.slice(0, 5);
            const endTime = daySchedule.end_time.slice(0, 5);
            // Check if current time is within window (supports overnight windows)
            if (startTime <= endTime) {
              // Normal window (e.g., 09:00-18:00)
              if (currentTimeStr < startTime || currentTimeStr > endTime) {
                console.log(`${adv.name}: Outside working hours ${startTime}-${endTime} (now: ${currentTimeStr} ${ruleTimezone})`);
                continue;
              }
            } else {
              // Overnight window (e.g., 22:00-04:00)
              if (currentTimeStr < startTime && currentTimeStr > endTime) {
                console.log(`${adv.name}: Outside overnight hours ${startTime}-${endTime} (now: ${currentTimeStr} ${ruleTimezone})`);
                continue;
              }
            }
          }
        } else if (rule.start_time && rule.end_time) {
          console.log(`${adv.name}: Checking daily schedule in ${ruleTimezone} (${currentTimeStr})`);
          // Simple daily time window
          const startTime = rule.start_time.slice(0, 5);
          const endTime = rule.end_time.slice(0, 5);
          // Check if current time is within window (supports overnight windows)
          if (startTime <= endTime) {
            // Normal window (e.g., 09:00-18:00)
            if (currentTimeStr < startTime || currentTimeStr > endTime) {
              console.log(`${adv.name}: Outside working hours ${startTime}-${endTime} (now: ${currentTimeStr} ${ruleTimezone})`);
              continue;
            }
          } else {
            // Overnight window (e.g., 22:00-04:00)
            if (currentTimeStr < startTime && currentTimeStr > endTime) {
              console.log(`${adv.name}: Outside overnight hours ${startTime}-${endTime} (now: ${currentTimeStr} ${ruleTimezone})`);
              continue;
            }
          }
        }

        const weight = rule.weight || 100;
        const priorityType = rule.priority_type || 'primary';

        // Check daily cap from rule or advertiser default
        const dailyLimit = rule.daily_cap || adv.daily_cap || 100;
        const dailyCount = dailyCounts.get(adv.id) || 0;
        if (dailyCount >= dailyLimit) {
          console.log(`${adv.name}: Daily cap reached (${dailyCount}/${dailyLimit})`);
          continue;
        }

        // Check hourly cap from rule or advertiser default
        const hourlyLimit = rule.hourly_cap || adv.hourly_cap;
        if (hourlyLimit) {
          const hourlyCount = hourlyCounts.get(adv.id) || 0;
          if (hourlyCount >= hourlyLimit) {
            console.log(`${adv.name}: Hourly cap reached (${hourlyCount}/${hourlyLimit})`);
            continue;
          }
        }

        const eligibleAdv: EligibleAdvertiser = { ...adv, weight, priority_type: priorityType };
        
        if (priorityType === 'fallback') {
          result.fallback.push(eligibleAdv);
        } else {
          result.primary.push(eligibleAdv);
        }
      }

      console.log(`Eligible PRIMARY: ${result.primary.map(a => `${a.name}(w:${a.weight})`).join(', ') || 'none'}`);
      console.log(`Eligible FALLBACK: ${result.fallback.map(a => `${a.name}(w:${a.weight})`).join(', ') || 'none'}`);
      return result;
    } else {
      // No rules found for this affiliate + country — do NOT fallback to default settings
      // This prevents leads from going to random advertisers without explicit rules
      console.log(`No distribution rules found for affiliate ${lead.affiliate_id} + country ${lead.country_code} - rejecting`);
      return result; // Return empty result — will trigger NO_ELIGIBLE_ADVERTISERS
    }
  }

  // FALLBACK: Only use default distribution settings when there's NO affiliate_id
  // (e.g., for internal test leads or injections without affiliate context)
  console.log('No affiliate_id on lead, using default distribution settings');

  // Get active advertisers
  const { data: advertisers, error: advError } = await supabase
    .from('advertisers')
    .select('*')
    .eq('is_active', true);

  if (advError || !advertisers?.length) {
    console.log('No active advertisers found');
    return result;
  }

  // Get distribution settings
  const { data: settings } = await supabase
    .from('advertiser_distribution_settings')
    .select('*')
    .eq('is_active', true);

  const settingsMap = new Map<string, DistributionSettings>();
  if (settings) {
    for (const s of settings) {
      settingsMap.set(s.advertiser_id, s as DistributionSettings);
    }
  }

  // Get today's distribution counts for cap checking
  const today = new Date().toISOString().split('T')[0];
  const { data: todayDistributions } = await supabase
    .from('lead_distributions')
    .select('advertiser_id')
    .gte('created_at', `${today}T00:00:00Z`)
    .eq('status', 'sent');

  const dailyCounts = new Map<string, number>();
  if (todayDistributions) {
    for (const d of todayDistributions) {
      dailyCounts.set(d.advertiser_id, (dailyCounts.get(d.advertiser_id) || 0) + 1);
    }
  }

  // Get hourly distribution counts
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
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

  // Current time for time window check - using UTC/GMT
  const now = new Date();
  const days: (keyof WeeklySchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getUTCDay()];
  const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}:00`;
  console.log(`Time check: ${currentDay} ${currentTime} (GMT)`);

  // Filter eligible advertisers - all go to primary for default settings
  for (const advRaw of advertisers) {
    const adv = advRaw as Advertiser;
    const setting = settingsMap.get(adv.id);
    const weight = setting?.base_weight || 100;

    // Check if this advertiser previously rejected this email
    if (priorRejections.has(adv.id)) {
      console.log(`${adv.name}: Previously rejected this email`);
      continue;
    }

    // Check if distribution setting is active
    if (setting && !setting.is_active) {
      console.log(`${adv.name}: Distribution setting is inactive`);
      continue;
    }

    // Check daily cap
    const dailyLimit = setting?.default_daily_cap || adv.daily_cap || 100;
    const dailyCount = dailyCounts.get(adv.id) || 0;
    if (dailyCount >= dailyLimit) {
      console.log(`${adv.name}: Daily cap reached (${dailyCount}/${dailyLimit})`);
      continue;
    }

    // Check hourly cap
    const hourlyLimit = setting?.default_hourly_cap || adv.hourly_cap;
    if (hourlyLimit) {
      const hourlyCount = hourlyCounts.get(adv.id) || 0;
      if (hourlyCount >= hourlyLimit) {
        console.log(`${adv.name}: Hourly cap reached (${hourlyCount}/${hourlyLimit})`);
        continue;
      }
    }

    // Check country targeting
    if (setting?.countries?.length) {
      if (!setting.countries.includes(lead.country_code)) {
        console.log(`${adv.name}: Country ${lead.country_code} not in target list`);
        continue;
      }
    }

    // Check affiliate targeting
    if (setting?.affiliates?.length && lead.affiliate_id) {
      if (!setting.affiliates.includes(lead.affiliate_id)) {
        console.log(`${adv.name}: Affiliate not in target list`);
        continue;
      }
    }

    // Check time window - use weekly_schedule if available, otherwise fall back to start_time/end_time
    if (setting?.weekly_schedule) {
      const daySchedule = setting.weekly_schedule[currentDay];
      if (!daySchedule?.is_active) {
        console.log(`${adv.name}: ${currentDay} is a day off`);
        continue;
      }
      if (daySchedule.start_time && daySchedule.end_time) {
        const startTime = daySchedule.start_time + ':00';
        const endTime = daySchedule.end_time + ':00';
        if (currentTime < startTime || currentTime > endTime) {
          console.log(`${adv.name}: Outside ${currentDay} time window (${daySchedule.start_time}-${daySchedule.end_time})`);
          continue;
        }
      }
    } else if (setting?.start_time && setting?.end_time) {
      // Fallback to legacy start_time/end_time
      if (currentTime < setting.start_time || currentTime > setting.end_time) {
        console.log(`${adv.name}: Outside time window (${setting.start_time}-${setting.end_time})`);
        continue;
      }
    }

    result.primary.push({ ...adv, weight, priority_type: 'primary' });
  }

  console.log(`Eligible advertisers: ${result.primary.map(a => `${a.name}(w:${a.weight})`).join(', ')}`);
  return result;
}

// Select an advertiser using weighted random selection
function selectWeightedAdvertiser(advertisers: EligibleAdvertiser[]): EligibleAdvertiser {
  if (advertisers.length === 1) return advertisers[0];

  // Calculate total weight
  const totalWeight = advertisers.reduce((sum, adv) => sum + adv.weight, 0);
  
  // Generate random number between 0 and totalWeight
  const random = Math.random() * totalWeight;
  
  // Select advertiser based on cumulative weight
  let cumulative = 0;
  for (const adv of advertisers) {
    cumulative += adv.weight;
    if (random < cumulative) {
      console.log(`Weighted selection: ${adv.name} (weight: ${adv.weight}/${totalWeight}, ${((adv.weight/totalWeight)*100).toFixed(1)}%)`);
      return adv;
    }
  }
  
  // Fallback to last advertiser (shouldn't happen)
  return advertisers[advertisers.length - 1];
}

// Reorder advertisers for failover: selected first, then others by weight
function orderForFailover(advertisers: EligibleAdvertiser[], selectedId: string): EligibleAdvertiser[] {
  const selected = advertisers.find(a => a.id === selectedId);
  const others = advertisers.filter(a => a.id !== selectedId).sort((a, b) => b.weight - a.weight);
  
  if (selected) {
    return [selected, ...others];
  }
  return others;
}

// Helper to send callback to affiliate with autologin URL
async function sendAffiliateCallback(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  lead: Lead,
  autologinUrl: string,
  externalLeadId: string | null,
  advertiserName: string
): Promise<void> {
  if (!lead.affiliate_id) {
    console.log('No affiliate_id on lead, skipping callback');
    return;
  }

  // Get affiliate's callback URL
  const { data: affiliate, error: affError } = await supabase
    .from('affiliates')
    .select('id, name, callback_url')
    .eq('id', lead.affiliate_id)
    .maybeSingle();

  if (affError || !affiliate) {
    console.log('Affiliate not found for callback');
    return;
  }

  if (!affiliate.callback_url) {
    console.log(`Affiliate ${affiliate.name} has no callback_url configured, skipping`);
    return;
  }

  // Build callback payload
  const callbackPayload = {
    lead_id: lead.id,
    email: lead.email,
    firstname: lead.firstname,
    lastname: lead.lastname,
    autologin_url: autologinUrl,
    external_lead_id: externalLeadId,
    advertiser: advertiserName,
    status: 'sent',
    sent_at: new Date().toISOString(),
  };

  try {
    console.log(`Sending autologin callback to affiliate ${affiliate.name} at ${affiliate.callback_url}`);
    
    const callbackResponse = await fetch(affiliate.callback_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callbackPayload),
    });

    const callbackText = await callbackResponse.text();
    console.log(`Affiliate callback response (${callbackResponse.status}):`, callbackText.substring(0, 200));

    // Log the callback attempt
    await supabase.from('callback_logs').insert({
      callback_type: 'affiliate_autologin',
      lead_id: lead.id,
      request_method: 'POST',
      request_url: affiliate.callback_url,
      request_payload: callbackPayload,
      processing_status: callbackResponse.ok ? 'success' : 'failed',
      processing_error: callbackResponse.ok ? null : callbackText.substring(0, 500),
      processed_at: new Date().toISOString(),
    });
  } catch (callbackError) {
    const errorMsg = callbackError instanceof Error ? callbackError.message : 'Unknown error';
    console.error(`Failed to send affiliate callback: ${errorMsg}`);
    
    // Log the failed callback attempt
    await supabase.from('callback_logs').insert({
      callback_type: 'affiliate_autologin',
      lead_id: lead.id,
      request_method: 'POST',
      request_url: affiliate.callback_url,
      request_payload: callbackPayload,
      processing_status: 'failed',
      processing_error: errorMsg,
      processed_at: new Date().toISOString(),
    });
  }
}

async function distributeLead(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  lead: Lead,
  advertiser: Advertiser
): Promise<DistributionResult> {
  // For custom advertisers, fetch the integration config and attach it
  let advertiserWithConfig = advertiser;
  if (advertiser.advertiser_type === 'custom') {
    const { data: integrationConfig } = await supabase
      .from('advertiser_integration_configs')
      .select('*')
      .eq('advertiser_id', advertiser.id)
      .maybeSingle();
    
    if (integrationConfig) {
      advertiserWithConfig = {
        ...advertiser,
        config: {
          ...advertiser.config,
          integration_config: integrationConfig,
        },
      };
      console.log(`Loaded integration config for custom advertiser ${advertiser.name}`);
    } else {
      console.warn(`No integration config found for custom advertiser ${advertiser.name}`);
    }
  }

  const adapter = advertiserAdapters[advertiserWithConfig.advertiser_type] || advertiserAdapters.custom;

  try {
    console.log(`Distributing lead ${lead.id} to ${advertiser.name} (${advertiser.advertiser_type})`);
    
    const { success, response } = await adapter(lead, advertiserWithConfig);
    
    // Extract external lead ID and autologin URL from response
    const externalLeadId = success ? extractExternalLeadId(response) : null;
    const autologinUrl = success ? extractAutologinUrl(response) : null;
    
    if (externalLeadId) {
      console.log(`Extracted external_lead_id: ${externalLeadId}`);
    }
    if (autologinUrl) {
      console.log(`Extracted autologin_url: ${autologinUrl}`);
    }

    if (success) {
      // Only record distribution on success
      await supabase.from('lead_distributions').insert({
        lead_id: lead.id,
        advertiser_id: advertiser.id,
        affiliate_id: lead.affiliate_id,
        status: 'sent',
        response: response.substring(0, 1000),
        external_lead_id: externalLeadId,
        autologin_url: autologinUrl,
        sent_at: new Date().toISOString(),
      });

      // Update lead distributed_at
      await supabase
        .from('leads')
        .update({ distributed_at: new Date().toISOString(), status: 'contacted' })
        .eq('id', lead.id);

      // Update conversion stats
      const { data: existingConversion } = await supabase
        .from('advertiser_conversions')
        .select('id, leads')
        .eq('advertiser_id', advertiser.id)
        .maybeSingle();

      if (existingConversion) {
        await supabase
          .from('advertiser_conversions')
          .update({ leads: existingConversion.leads + 1 })
          .eq('id', existingConversion.id);
      } else {
        await supabase.from('advertiser_conversions').insert({
          advertiser_id: advertiser.id,
          leads: 1,
          conversion: 0,
          failed_leads: 0,
        });
      }

      // Send autologin URL to affiliate callback if available
      if (autologinUrl) {
        await sendAffiliateCallback(supabase, lead, autologinUrl, externalLeadId, advertiser.name);
      }
    } else {
      // Record failed distribution attempt in lead_distributions for debugging
      await supabase.from('lead_distributions').insert({
        lead_id: lead.id,
        advertiser_id: advertiser.id,
        affiliate_id: lead.affiliate_id,
        status: 'failed',
        response: response.substring(0, 1000),
        sent_at: new Date().toISOString(),
      });

      // Also record in rejected_leads for detailed tracking
      await supabase.from('rejected_leads').insert({
        lead_id: lead.id,
        advertiser_id: advertiser.id,
        reason: response.substring(0, 500),
      });

      // Record this email+advertiser rejection to prevent future re-sends
      await recordEmailRejection(supabase, lead.email, advertiser.id, response);

      // Update failed count
      const { data: existingConversion } = await supabase
        .from('advertiser_conversions')
        .select('id, failed_leads')
        .eq('advertiser_id', advertiser.id)
        .maybeSingle();

      if (existingConversion) {
        await supabase
          .from('advertiser_conversions')
          .update({ failed_leads: existingConversion.failed_leads + 1 })
          .eq('id', existingConversion.id);
      } else {
        await supabase.from('advertiser_conversions').insert({
          advertiser_id: advertiser.id,
          leads: 0,
          conversion: 0,
          failed_leads: 1,
        });
      }
    }

    return {
      success,
      advertiser_id: advertiser.id,
      advertiser_name: advertiser.name,
      external_lead_id: externalLeadId || undefined,
      autologin_url: autologinUrl || undefined,
      response: success ? 'Lead distributed successfully' : response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Distribution error for ${advertiser.name}:`, errorMessage);

    // Record failed distribution in lead_distributions for debugging
    await supabase.from('lead_distributions').insert({
      lead_id: lead.id,
      advertiser_id: advertiser.id,
      affiliate_id: lead.affiliate_id,
      status: 'failed',
      response: errorMessage.substring(0, 1000),
      sent_at: new Date().toISOString(),
    });

    // Also record in rejected_leads for detailed tracking
    await supabase.from('rejected_leads').insert({
      lead_id: lead.id,
      advertiser_id: advertiser.id,
      reason: errorMessage.substring(0, 500),
    });

    // Record this email+advertiser rejection to prevent future re-sends
    await recordEmailRejection(supabase, lead.email, advertiser.id, errorMessage);

    return {
      success: false,
      advertiser_id: advertiser.id,
      advertiser_name: advertiser.name,
      error: errorMessage,
    };
  }
}

Deno.serve(async (req) => {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // Health check support
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "distribute-lead" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id, advertiser_id, test_mode, test_lead_data, user_id, is_resend, force_advertiser_id } = body;

    // Test mode: Try distribution first, create lead only if successful
    // This is used by both manual "Send Test Lead" and affiliate API submissions
    if (test_mode && test_lead_data) {
      
      // If specific advertiser_id is provided, use that advertiser only
      if (advertiser_id) {
        const { data: advertiser, error: advError } = await supabase
          .from('advertisers')
          .select('*')
          .eq('id', advertiser_id)
          .eq('is_active', true)
          .single();

        if (advError || !advertiser) {
          return new Response(
            JSON.stringify({ success: false, message: 'Advertiser not found or inactive' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const typedAdvertiser = advertiser as Advertiser;
        const adapter = advertiserAdapters[typedAdvertiser.advertiser_type] || advertiserAdapters.custom;
        
        // Create a mock lead object from test data for the API call
        const testLead: Lead = {
          id: 'test-' + Date.now(),
          firstname: test_lead_data.firstname,
          lastname: test_lead_data.lastname,
          email: test_lead_data.email,
          mobile: test_lead_data.mobile,
          country_code: test_lead_data.country_code,
          country: test_lead_data.country,
          ip_address: test_lead_data.ip_address,
          offer_name: test_lead_data.offer_name,
          custom1: test_lead_data.custom1,
          custom2: test_lead_data.custom2,
          custom3: test_lead_data.custom3,
          affiliate_id: test_lead_data.affiliate_id,
        };

        console.log(`[TEST MODE] Sending test lead to ${typedAdvertiser.name}`);
        
        try {
          const { success, response, requestMetadata } = await adapter(testLead, typedAdvertiser);
          
          let createdLeadId: string | null = null;
          
          // If successful, create the lead and distribution records
          if (success) {
            // Create the lead in the database
            const { data: newLead, error: leadError } = await supabase
              .from('leads')
              .insert({
                firstname: test_lead_data.firstname,
                lastname: test_lead_data.lastname,
                email: test_lead_data.email,
                mobile: test_lead_data.mobile,
                country_code: test_lead_data.country_code,
                country: test_lead_data.country,
                ip_address: test_lead_data.ip_address,
                offer_name: test_lead_data.offer_name,
                custom1: test_lead_data.custom1,
                custom2: test_lead_data.custom2,
                custom3: test_lead_data.custom3,
                affiliate_id: test_lead_data.affiliate_id || null,
                status: 'contacted',
                distributed_at: new Date().toISOString(),
              })
              .select('id')
              .single();
            
            if (!leadError && newLead) {
              createdLeadId = newLead.id;
              
              // Extract external lead ID and autologin URL from response
              const externalLeadId = extractExternalLeadId(response);
              const autologinUrl = extractAutologinUrl(response);
              
              if (externalLeadId) {
                console.log(`[TEST MODE] Extracted external_lead_id: ${externalLeadId}`);
              }
              if (autologinUrl) {
                console.log(`[TEST MODE] Extracted autologin_url: ${autologinUrl}`);
              }
              
              // Create distribution record with extracted IDs
              await supabase.from('lead_distributions').insert({
                lead_id: newLead.id,
                advertiser_id: typedAdvertiser.id,
                affiliate_id: test_lead_data.affiliate_id || null,
                status: 'sent',
                response: response.substring(0, 1000),
                external_lead_id: externalLeadId,
                autologin_url: autologinUrl,
                sent_at: new Date().toISOString(),
              });
              
              // Update conversion stats
              const { data: existingConversion } = await supabase
                .from('advertiser_conversions')
                .select('id, leads')
                .eq('advertiser_id', typedAdvertiser.id)
                .maybeSingle();

              if (existingConversion) {
                await supabase
                  .from('advertiser_conversions')
                  .update({ leads: existingConversion.leads + 1 })
                  .eq('id', existingConversion.id);
              } else {
                await supabase.from('advertiser_conversions').insert({
                  advertiser_id: typedAdvertiser.id,
                  leads: 1,
                  conversion: 0,
                  failed_leads: 0,
                });
              }
            }
          }
          
          // If rejected, record this email+advertiser combination to prevent future re-sends
          if (!success) {
            await recordEmailRejection(supabase, test_lead_data.email, typedAdvertiser.id, response);
          }
          
          // Log the test attempt with request metadata
          await supabase.from('test_lead_logs').insert({
            advertiser_id: typedAdvertiser.id,
            test_data: test_lead_data,
            success,
            response: response.substring(0, 2000),
            created_by: user_id || null,
            request_url: requestMetadata?.url || null,
            request_headers: requestMetadata?.headers || null,
            request_payload: requestMetadata?.payload || null,
          });
          
          return new Response(
            JSON.stringify({
              success,
              message: success ? 'Test lead sent and saved successfully' : 'Test lead rejected',
              test_mode: true,
              advertiser_name: typedAdvertiser.name,
              advertiser_response: response,
              lead_id: createdLeadId,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Record rejection on error as well
          await recordEmailRejection(supabase, test_lead_data.email, typedAdvertiser.id, errorMessage);
          
          // Log the failed test attempt
          await supabase.from('test_lead_logs').insert({
            advertiser_id: typedAdvertiser.id,
            test_data: test_lead_data,
            success: false,
            response: errorMessage,
            created_by: user_id || null,
          });
          
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Test lead failed',
              test_mode: true,
              advertiser_name: typedAdvertiser.name,
              error: errorMessage,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // No specific advertiser_id - use eligibility and weighted selection
      // Create mock lead for eligibility check
      const mockLead: Lead = {
        id: 'pending-' + Date.now(),
        firstname: test_lead_data.firstname,
        lastname: test_lead_data.lastname,
        email: test_lead_data.email,
        mobile: test_lead_data.mobile,
        country_code: test_lead_data.country_code,
        country: test_lead_data.country,
        ip_address: test_lead_data.ip_address,
        offer_name: test_lead_data.offer_name,
        custom1: test_lead_data.custom1,
        custom2: test_lead_data.custom2,
        custom3: test_lead_data.custom3,
        affiliate_id: test_lead_data.affiliate_id,
      };
      
      // Get eligible advertisers
      const { primary, fallback } = await getEligibleAdvertisers(supabase, mockLead);
      
      if (!primary.length && !fallback.length) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'No eligible advertisers available',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Try PRIMARY advertisers first
      const allAdvertisers = [...primary, ...fallback];
      let lastRejectionReason = '';
      let lastRejectionAdvertiser = '';
      
      if (primary.length > 0) {
        const selectedPrimary = selectWeightedAdvertiser(primary);
        const orderedPrimary = orderForFailover(primary, selectedPrimary.id);
        
        for (const advertiser of orderedPrimary) {
          const adapter = advertiserAdapters[advertiser.advertiser_type] || advertiserAdapters.custom;
          
          try {
            console.log(`[DISTRIBUTION-FIRST] Trying ${advertiser.name}...`);
            const { success, response } = await adapter(mockLead, advertiser);
            
            if (success) {
              // Create the lead now that we have success
              const { data: newLead, error: leadError } = await supabase
                .from('leads')
                .insert({
                  firstname: test_lead_data.firstname,
                  lastname: test_lead_data.lastname,
                  email: test_lead_data.email,
                  mobile: test_lead_data.mobile,
                  country_code: test_lead_data.country_code,
                  country: test_lead_data.country,
                  ip_address: test_lead_data.ip_address,
                  offer_name: test_lead_data.offer_name,
                  custom1: test_lead_data.custom1,
                  custom2: test_lead_data.custom2,
                  custom3: test_lead_data.custom3,
                  affiliate_id: test_lead_data.affiliate_id || null,
                  status: 'contacted',
                  distributed_at: new Date().toISOString(),
                })
                .select('id')
                .single();
              
              if (leadError || !newLead) {
                console.error('Failed to create lead after successful distribution:', leadError);
                return new Response(
                  JSON.stringify({ success: false, message: 'Failed to save lead after distribution' }),
                  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              // Extract IDs and create distribution record
              const externalLeadId = extractExternalLeadId(response);
              const autologinUrl = extractAutologinUrl(response);
              
              await supabase.from('lead_distributions').insert({
                lead_id: newLead.id,
                advertiser_id: advertiser.id,
                affiliate_id: test_lead_data.affiliate_id || null,
                status: 'sent',
                response: response.substring(0, 1000),
                external_lead_id: externalLeadId,
                autologin_url: autologinUrl,
                sent_at: new Date().toISOString(),
              });
              
              // Update conversion stats
              const { data: existingConversion } = await supabase
                .from('advertiser_conversions')
                .select('id, leads')
                .eq('advertiser_id', advertiser.id)
                .maybeSingle();

              if (existingConversion) {
                await supabase
                  .from('advertiser_conversions')
                  .update({ leads: existingConversion.leads + 1 })
                  .eq('id', existingConversion.id);
              } else {
                await supabase.from('advertiser_conversions').insert({
                  advertiser_id: advertiser.id,
                  leads: 1,
                  conversion: 0,
                  failed_leads: 0,
                });
              }
              
              console.log(`[DISTRIBUTION-FIRST] Success with ${advertiser.name}, lead ${newLead.id} created`);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  message: 'Lead distributed successfully',
                  lead_id: newLead.id,
                  advertiser_name: advertiser.name,
                  autologin_url: autologinUrl,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              // Record rejection and try next - capture reason for final response
              lastRejectionReason = parseRejectionReason(response);
              lastRejectionAdvertiser = advertiser.name;
              await recordEmailRejection(supabase, test_lead_data.email, advertiser.id, response);
              console.log(`[DISTRIBUTION-FIRST] ${advertiser.name} rejected: ${lastRejectionReason}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            lastRejectionReason = errorMessage;
            lastRejectionAdvertiser = advertiser.name;
            await recordEmailRejection(supabase, test_lead_data.email, advertiser.id, errorMessage);
            console.log(`[DISTRIBUTION-FIRST] ${advertiser.name} error: ${errorMessage}`);
          }
        }
      }
      
      // Try FALLBACK advertisers if primary all failed
      if (fallback.length > 0) {
        const selectedFallback = selectWeightedAdvertiser(fallback);
        const orderedFallback = orderForFailover(fallback, selectedFallback.id);
        
        for (const advertiser of orderedFallback) {
          const adapter = advertiserAdapters[advertiser.advertiser_type] || advertiserAdapters.custom;
          
          try {
            console.log(`[DISTRIBUTION-FIRST] Trying fallback ${advertiser.name}...`);
            const { success, response } = await adapter(mockLead, advertiser);
            
            if (success) {
              // Create the lead now
              const { data: newLead, error: leadError } = await supabase
                .from('leads')
                .insert({
                  firstname: test_lead_data.firstname,
                  lastname: test_lead_data.lastname,
                  email: test_lead_data.email,
                  mobile: test_lead_data.mobile,
                  country_code: test_lead_data.country_code,
                  country: test_lead_data.country,
                  ip_address: test_lead_data.ip_address,
                  offer_name: test_lead_data.offer_name,
                  custom1: test_lead_data.custom1,
                  custom2: test_lead_data.custom2,
                  custom3: test_lead_data.custom3,
                  affiliate_id: test_lead_data.affiliate_id || null,
                  status: 'contacted',
                  distributed_at: new Date().toISOString(),
                })
                .select('id')
                .single();
              
              if (leadError || !newLead) {
                console.error('Failed to create lead after successful distribution:', leadError);
                return new Response(
                  JSON.stringify({ success: false, message: 'Failed to save lead after distribution' }),
                  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              const externalLeadId = extractExternalLeadId(response);
              const autologinUrl = extractAutologinUrl(response);
              
              await supabase.from('lead_distributions').insert({
                lead_id: newLead.id,
                advertiser_id: advertiser.id,
                affiliate_id: test_lead_data.affiliate_id || null,
                status: 'sent',
                response: response.substring(0, 1000),
                external_lead_id: externalLeadId,
                autologin_url: autologinUrl,
                sent_at: new Date().toISOString(),
              });
              
              // Update conversion stats
              const { data: existingConversion } = await supabase
                .from('advertiser_conversions')
                .select('id, leads')
                .eq('advertiser_id', advertiser.id)
                .maybeSingle();

              if (existingConversion) {
                await supabase
                  .from('advertiser_conversions')
                  .update({ leads: existingConversion.leads + 1 })
                  .eq('id', existingConversion.id);
              } else {
                await supabase.from('advertiser_conversions').insert({
                  advertiser_id: advertiser.id,
                  leads: 1,
                  conversion: 0,
                  failed_leads: 0,
                });
              }
              
              console.log(`[DISTRIBUTION-FIRST] Success with fallback ${advertiser.name}, lead ${newLead.id} created`);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  message: 'Lead distributed successfully (via fallback)',
                  lead_id: newLead.id,
                  advertiser_name: advertiser.name,
                  autologin_url: autologinUrl,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              // Capture rejection reason for final response
              lastRejectionReason = parseRejectionReason(response);
              lastRejectionAdvertiser = advertiser.name;
              await recordEmailRejection(supabase, test_lead_data.email, advertiser.id, response);
              console.log(`[DISTRIBUTION-FIRST] Fallback ${advertiser.name} rejected: ${lastRejectionReason}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            lastRejectionReason = errorMessage;
            lastRejectionAdvertiser = advertiser.name;
            await recordEmailRejection(supabase, test_lead_data.email, advertiser.id, errorMessage);
            console.log(`[DISTRIBUTION-FIRST] Fallback ${advertiser.name} error: ${errorMessage}`);
          }
        }
      }
      
      // All advertisers rejected - don't create lead, return the actual rejection reason
      console.log(`[DISTRIBUTION-FIRST] All advertisers rejected for ${test_lead_data.email}, last reason: ${lastRejectionReason}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'All advertisers rejected this lead',
          advertiser_response: lastRejectionReason || 'Advertiser did not accept this lead',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lead_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'lead_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ success: false, message: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typedLead = lead as Lead;

    // Check if already distributed (skip for resends)
    if (typedLead.distributed_at && !is_resend) {
      return new Response(
        JSON.stringify({ success: false, message: 'Lead already distributed' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For resends, use force_advertiser_id if provided
    const targetAdvertiserId = is_resend && force_advertiser_id ? force_advertiser_id : advertiser_id;

    // If specific advertiser is provided (or force_advertiser_id for resends), distribute to that advertiser only
    if (targetAdvertiserId) {
      const { data: advertiser, error: advError } = await supabase
        .from('advertisers')
        .select('*')
        .eq('id', targetAdvertiserId)
        .eq('is_active', true)
        .single();

      if (advError || !advertiser) {
        return new Response(
          JSON.stringify({ success: false, message: 'Advertiser not found or inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await distributeLead(supabase, typedLead, advertiser as Advertiser);
      
      return new Response(
        JSON.stringify({
          success: result.success,
          message: result.success ? 'Lead distributed successfully' : result.response || result.error,
          lead_id,
          advertiser_id: result.advertiser_id,
          advertiser_name: result.advertiser_name,
          autologin_url: result.autologin_url,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Otherwise, get eligible advertisers and use weighted selection
    const { primary, fallback } = await getEligibleAdvertisers(supabase, typedLead);

    if (!primary.length && !fallback.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No eligible advertisers available',
          lead_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1: Try PRIMARY advertisers first (using weighted selection)
    if (primary.length > 0) {
      const selectedPrimary = selectWeightedAdvertiser(primary);
      const orderedPrimary = orderForFailover(primary, selectedPrimary.id);

      for (const advertiser of orderedPrimary) {
        const result = await distributeLead(supabase, typedLead, advertiser);
        
        if (result.success) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Lead distributed successfully',
              lead_id,
              advertiser_id: result.advertiser_id,
              advertiser_name: result.advertiser_name,
              autologin_url: result.autologin_url,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log(`Failed to distribute to ${advertiser.name} (primary), trying next...`);
      }
      console.log('All primary advertisers failed, trying fallback...');
    }

    // STEP 2: If all PRIMARY failed, try FALLBACK advertisers
    if (fallback.length > 0) {
      const selectedFallback = selectWeightedAdvertiser(fallback);
      const orderedFallback = orderForFailover(fallback, selectedFallback.id);

      for (const advertiser of orderedFallback) {
        const result = await distributeLead(supabase, typedLead, advertiser);
        
        if (result.success) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Lead distributed successfully (via fallback)',
              lead_id,
              advertiser_id: result.advertiser_id,
              advertiser_name: result.advertiser_name,
              autologin_url: result.autologin_url,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log(`Failed to distribute to ${advertiser.name} (fallback), trying next...`);
      }
    }

    // All advertisers (primary + fallback) failed
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Distribution failed for all eligible advertisers',
        lead_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
