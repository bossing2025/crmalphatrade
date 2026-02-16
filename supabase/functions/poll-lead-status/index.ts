import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadDistribution {
  id: string;
  lead_id: string;
  advertiser_id: string;
  external_lead_id: string | null;
  last_polled_at: string | null;
  created_at: string;
  leads: {
    id: string;
    email: string;
    firstname: string;
    lastname: string;
    status: string;
    is_ftd: boolean;
  };
  advertisers: {
    id: string;
    name: string;
    advertiser_type: string;
    api_key: string;
    status_endpoint: string | null;
    url: string | null;
    config: Record<string, unknown>;
  };
}

interface EnigmaLeadItem {
  leadRequestIDEncoded: string;
  customerID: string;
  hasFTD: number | boolean;
  saleStatus: string | null;
  signupDate: string;
  countryCode: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
}

interface EliteCRMLeadItem {
  id: number;
  lead_code: string;
  firstname: string;
  lastname: string;
  email: string;
  country_code: string;
  mobile: string;
  status: string | null;
  is_ftd: number;
  ftd_date: string | null;
}

interface StatusResponse {
  status?: string;
  is_ftd?: boolean;
  ftd_date?: string;
  converted?: boolean;
  deposited?: boolean;
}

interface ElnopyLeadItem {
  id: number;
  source: string;
  funnel: string;
  status: string;
  link_id: number;
  domain: string;
  acq: number; // 1 = FTD/Yes, 0 = No
  created_at: string;
}

// Helper function to log status changes to lead_status_history
async function logStatusChange(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  leadId: string | null,
  injectionLeadId: string | null,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  changeSource: string = 'advertiser_poll'
): Promise<void> {
  try {
    await supabase.from('lead_status_history').insert({
      lead_id: leadId,
      injection_lead_id: injectionLeadId,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      change_source: changeSource,
      change_reason: 'Status update from advertiser polling',
    });
    console.log(`Logged status change: ${fieldName} ${oldValue} → ${newValue}`);
  } catch (error) {
    console.error(`Failed to log status change: ${error}`);
  }
}

// Format date for Enigma API (YYYY-MM-DD HH:mm:ss)
function formatEnigmaDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// VPS forwarder URL for IP whitelisting (uses main domain path)
const FORWARDER_URL = 'https://megatroncrm.online/proxy/forward.php';

// Poll Enigma using their bulk leads API (routed through VPS forwarder)
async function pollEnigmaLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: LeadDistribution['advertisers'],
  distributions: LeadDistribution[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  // Use status_endpoint if configured, otherwise fall back to url
  const baseUrl = advertiser.status_endpoint || advertiser.url;
  if (!baseUrl) {
    console.log(`Enigma advertiser ${advertiser.name} has no URL configured`);
    return { updated: 0, errors: 0 };
  }

  // Build the status URL - use the same base domain as the lead submission
  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}/api/v2/leads`;
  } catch {
    console.log(`Invalid URL for Enigma advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  // Get date range - poll leads from last 30 days
  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const url = new URL(statusUrl);
  url.searchParams.set('fromDate', formatEnigmaDate(fromDate));
  url.searchParams.set('toDate', formatEnigmaDate(toDate));
  url.searchParams.set('itemsPerPage', '1000');

  console.log(`Enigma bulk status URL: ${url.toString()}`);
  console.log(`Routing through VPS forwarder: ${FORWARDER_URL}`);

  try {
    // Route through VPS forwarder for IP whitelisting
    // Use X-Http-Method: GET since RevDale's POST to same URL is for registration
    console.log(`Enigma bulk status URL: ${url.toString()}`);
    console.log(`Routing through VPS forwarder with GET method`);
    
    const authHeaderName = String(advertiser.config?.auth_header_name || 'Api-Key');
    const response = await fetch(FORWARDER_URL, {
      method: 'POST', // Forwarder accepts POST but uses X-Http-Method for target
      headers: {
        'X-Target-Url': url.toString(),
        'X-Http-Method': 'GET',
        [authHeaderName]: advertiser.api_key || '',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Enigma bulk status check failed: ${response.status}, body: ${errorText}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    console.log(`Enigma returned ${data.items?.length || 0} leads`);

    if (!data.items || !Array.isArray(data.items)) {
      console.log('Enigma response has no items array');
      return { updated: 0, errors: 0 };
    }

    // Create a map of leadRequestIDEncoded -> lead data for quick lookup
    const enigmaLeadsMap = new Map<string, EnigmaLeadItem>();
    for (const item of data.items as EnigmaLeadItem[]) {
      if (item.leadRequestIDEncoded) {
        enigmaLeadsMap.set(item.leadRequestIDEncoded, item);
      }
    }

    console.log(`Mapped ${enigmaLeadsMap.size} Enigma leads for matching`);

    // Match our distributions with Enigma leads
    for (const dist of distributions) {
      if (!dist.external_lead_id) continue;

      const enigmaLead = enigmaLeadsMap.get(dist.external_lead_id);
      
      // Update last_polled_at regardless of match
      await supabase
        .from('lead_distributions')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', dist.id);

      if (enigmaLead) {
        // Log raw Enigma data for debugging
        console.log(`Enigma data for ${dist.external_lead_id}: hasFTD=${enigmaLead.hasFTD}, saleStatus=${enigmaLead.saleStatus}`);
        
        const hasFtd = enigmaLead.hasFTD === 1 || enigmaLead.hasFTD === true;
        const leadUpdates: Record<string, unknown> = {};

        // Always store raw sale_status from advertiser
        const oldSaleStatus = (dist.leads as any).sale_status;
        if (enigmaLead.saleStatus && enigmaLead.saleStatus !== oldSaleStatus) {
          leadUpdates.sale_status = enigmaLead.saleStatus;
          console.log(`Sale status updated for lead ${dist.lead_id}: ${enigmaLead.saleStatus}`);
          // Log status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'sale_status', oldSaleStatus, enigmaLead.saleStatus);
        }

        // Check if FTD status changed
        if (hasFtd && !dist.leads.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = enigmaLead.signupDate || new Date().toISOString();
          console.log(`FTD detected for lead ${dist.lead_id} (Enigma ID: ${dist.external_lead_id})`);
          // Log FTD status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'is_ftd', 'false', 'true');

          // Update conversion stats
          const { data: existingConversion } = await supabase
            .from('advertiser_conversions')
            .select('id, conversion')
            .eq('advertiser_id', dist.advertiser_id)
            .maybeSingle();

          if (existingConversion) {
            const conversionData = existingConversion as { id: string; conversion: number };
            await supabase
              .from('advertiser_conversions')
              .update({ conversion: conversionData.conversion + 1 })
              .eq('id', conversionData.id);
          }
        }

        // No mapping needed - sale_status stores the raw advertiser status

        // Apply updates if any
        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('leads')
            .update(leadUpdates)
            .eq('id', dist.lead_id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling Enigma: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Format date for EliteCRM API (MM/DD/YY)
function formatEliteCRMDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${year}`;
}

// Poll EliteCRM using their bulk leads API (direct call - no IP whitelisting required)
async function pollEliteCRMLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: LeadDistribution['advertisers'],
  distributions: LeadDistribution[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  // Use status_endpoint if configured, otherwise fall back to url
  const baseUrl = advertiser.status_endpoint || advertiser.url;
  if (!baseUrl) {
    console.log(`EliteCRM advertiser ${advertiser.name} has no URL configured`);
    return { updated: 0, errors: 0 };
  }

  // Build the status URL - use the same base domain as the lead submission
  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}/api/leads`;
  } catch {
    console.log(`Invalid URL for EliteCRM advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  // Get date range - poll leads from last 30 days
  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const url = new URL(statusUrl);
  url.searchParams.set('fromDate', formatEliteCRMDate(fromDate));
  url.searchParams.set('toDate', formatEliteCRMDate(toDate));

  console.log(`EliteCRM bulk status URL: ${url.toString()}`);

  try {
    // Direct call - EliteCRM doesn't require IP whitelisting for status checks
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Api-Key': advertiser.api_key || '',
      },
    });

    if (!response.ok) {
      console.log(`EliteCRM bulk status check failed: ${response.status}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    console.log(`EliteCRM returned ${data.data?.length || 0} leads`);

    if (!data.data || !Array.isArray(data.data)) {
      console.log('EliteCRM response has no data array');
      return { updated: 0, errors: 0 };
    }

    // Create a map of lead_id -> lead data for quick lookup
    const eliteCRMLeadsMap = new Map<string, EliteCRMLeadItem>();
    for (const item of data.data as EliteCRMLeadItem[]) {
      if (item.id) {
        eliteCRMLeadsMap.set(String(item.id), item);
      }
      // Also map by lead_code if available
      if (item.lead_code) {
        eliteCRMLeadsMap.set(item.lead_code, item);
      }
    }

    console.log(`Mapped ${eliteCRMLeadsMap.size} EliteCRM leads for matching`);

    // Match our distributions with EliteCRM leads
    for (const dist of distributions) {
      if (!dist.external_lead_id) continue;

      const eliteCRMLead = eliteCRMLeadsMap.get(dist.external_lead_id);
      
      // Update last_polled_at regardless of match
      await supabase
        .from('lead_distributions')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', dist.id);

      if (eliteCRMLead) {
        // Log raw EliteCRM data for debugging
        console.log(`EliteCRM data for ${dist.external_lead_id}: is_ftd=${eliteCRMLead.is_ftd}, ftd_date=${eliteCRMLead.ftd_date}, status=${eliteCRMLead.status}`);
        
        const hasFtd = eliteCRMLead.is_ftd === 1;
        const leadUpdates: Record<string, unknown> = {};

        // Store raw status from advertiser
        const oldSaleStatus = (dist.leads as any).sale_status;
        if (eliteCRMLead.status && eliteCRMLead.status !== oldSaleStatus) {
          leadUpdates.sale_status = eliteCRMLead.status;
          console.log(`Sale status updated for lead ${dist.lead_id}: ${eliteCRMLead.status}`);
          // Log status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'sale_status', oldSaleStatus, eliteCRMLead.status);
        }

        // Check if FTD status changed
        if (hasFtd && !dist.leads.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = eliteCRMLead.ftd_date || new Date().toISOString();
          console.log(`FTD detected for lead ${dist.lead_id} (EliteCRM ID: ${dist.external_lead_id})`);
          // Log FTD status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'is_ftd', 'false', 'true');

          // Update conversion stats
          const { data: existingConversion } = await supabase
            .from('advertiser_conversions')
            .select('id, conversion')
            .eq('advertiser_id', dist.advertiser_id)
            .maybeSingle();

          if (existingConversion) {
            const conversionData = existingConversion as { id: string; conversion: number };
            await supabase
              .from('advertiser_conversions')
              .update({ conversion: conversionData.conversion + 1 })
              .eq('id', conversionData.id);
          }
        }

        // Apply updates if any
        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('leads')
            .update(leadUpdates)
            .eq('id', dist.lead_id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling EliteCRM: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Poll EliteCRM for injection_leads (separate from main leads table)
async function pollEliteCRMInjectionLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: { id: string; name: string; api_key: string; url: string | null; status_endpoint: string | null },
  injectionLeads: { id: string; email: string; external_lead_id: string | null; is_ftd: boolean; sale_status: string | null }[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  const baseUrl = advertiser.status_endpoint || advertiser.url;
  if (!baseUrl) {
    console.log(`EliteCRM advertiser ${advertiser.name} has no URL configured for injection polling`);
    return { updated: 0, errors: 0 };
  }

  // Use standard bulk polling for all EliteCRM advertisers (including Egoli)

  // Standard EliteCRM bulk polling
  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}/api/leads`;
  } catch {
    console.log(`Invalid URL for EliteCRM advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const url = new URL(statusUrl);
  url.searchParams.set('fromDate', formatEliteCRMDate(fromDate));
  url.searchParams.set('toDate', formatEliteCRMDate(toDate));

  console.log(`EliteCRM injection polling URL: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Api-Key': advertiser.api_key || '',
      },
    });

    if (!response.ok) {
      console.log(`EliteCRM injection polling failed: ${response.status}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    const returnedEmails = (data.data || []).map((l: any) => l.email);
    console.log(`EliteCRM returned ${data.data?.length || 0} leads. Emails: ${returnedEmails.join(', ')}`);

    if (!data.data || !Array.isArray(data.data)) {
      return { updated: 0, errors: 0 };
    }

    // Map by email (primary) and ID (fallback)
    const eliteCRMByEmail = new Map<string, EliteCRMLeadItem>();
    const eliteCRMById = new Map<string, EliteCRMLeadItem>();
    for (const item of data.data as EliteCRMLeadItem[]) {
      if (item.email) {
        eliteCRMByEmail.set(item.email.toLowerCase(), item);
      }
      if (item.id) {
        eliteCRMById.set(String(item.id), item);
      }
    }
    
    // Log what we're looking for
    const lookingFor = injectionLeads.map(l => l.email).join(', ');
    console.log(`Looking for emails: ${lookingFor}`);

    // Match injection leads by email first, then by ID
    for (const injLead of injectionLeads) {
      // Try to match by email first
      let eliteCRMLead = eliteCRMByEmail.get(injLead.email.toLowerCase());
      
      // Fallback to ID matching if email not found
      if (!eliteCRMLead && injLead.external_lead_id) {
        eliteCRMLead = eliteCRMById.get(injLead.external_lead_id);
      }
      
      if (eliteCRMLead) {
        console.log(`EliteCRM match for ${injLead.email}: is_ftd=${eliteCRMLead.is_ftd}, status=${eliteCRMLead.status}, ftd_date=${eliteCRMLead.ftd_date}`);
        
        const hasFtd = eliteCRMLead.is_ftd === 1;
        const leadUpdates: Record<string, unknown> = {};

        // Store raw status
        if (eliteCRMLead.status && String(eliteCRMLead.status) !== String(injLead.sale_status)) {
          leadUpdates.sale_status = String(eliteCRMLead.status);
          console.log(`Injection lead ${injLead.email} sale_status updated: ${eliteCRMLead.status}`);
          // Log status change to history for injection lead
          await logStatusChange(supabase, null, injLead.id, 'sale_status', injLead.sale_status, String(eliteCRMLead.status));
        }

        // Check FTD
        if (hasFtd && !injLead.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = eliteCRMLead.ftd_date || new Date().toISOString();
          console.log(`Injection lead ${injLead.email} FTD detected: ${eliteCRMLead.ftd_date}`);
          // Log FTD status change to history
          await logStatusChange(supabase, null, injLead.id, 'is_ftd', 'false', 'true');
        }

        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('injection_leads')
            .update(leadUpdates)
            .eq('id', injLead.id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling EliteCRM for injections: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Egoli-specific: Poll each injection lead individually by email
async function pollEgoliInjectionLeadsPerEmail(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: { id: string; name: string; api_key: string; url: string | null; status_endpoint: string | null },
  injectionLeads: { id: string; email: string; external_lead_id: string | null; is_ftd: boolean; sale_status: string | null }[],
  baseUrl: string
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  let origin: string;
  try {
    const urlObj = new URL(baseUrl);
    origin = urlObj.origin;
  } catch {
    console.log(`Invalid URL for Egoli: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  console.log(`Egoli per-email polling for ${injectionLeads.length} leads`);

  for (const injLead of injectionLeads) {
    const email = encodeURIComponent(injLead.email);
    const url = `${origin}/api/leads/update/${email}`;
    
    console.log(`Egoli polling: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Api-Key': advertiser.api_key || '',
        },
      });

      if (!response.ok) {
        console.log(`Egoli polling failed for ${injLead.email}: ${response.status}`);
        errors++;
        continue;
      }

      const data = await response.json();
      console.log(`Egoli response for ${injLead.email}: ${JSON.stringify(data)}`);

      // Handle response - could be single lead object or wrapped in data
      const leadData = data.data || data;
      
      if (!leadData) {
        console.log(`No data returned for ${injLead.email}`);
        continue;
      }

      const hasFtd = leadData.is_ftd === 1;
      const leadUpdates: Record<string, unknown> = {};

      // Store raw status
      if (leadData.status && String(leadData.status) !== String(injLead.sale_status)) {
        leadUpdates.sale_status = String(leadData.status);
        console.log(`Egoli lead ${injLead.email} sale_status updated: ${leadData.status}`);
        // Log status change to history
        await logStatusChange(supabase, null, injLead.id, 'sale_status', injLead.sale_status, String(leadData.status));
      }

      // Check FTD
      if (hasFtd && !injLead.is_ftd) {
        leadUpdates.is_ftd = true;
        leadUpdates.ftd_date = leadData.ftd_date || new Date().toISOString();
        console.log(`Egoli lead ${injLead.email} FTD detected: ${leadData.ftd_date}`);
        // Log FTD status change to history
        await logStatusChange(supabase, null, injLead.id, 'is_ftd', 'false', 'true');
      }

      if (Object.keys(leadUpdates).length > 0) {
        await supabase
          .from('injection_leads')
          .update(leadUpdates)
          .eq('id', injLead.id);
        updated++;
      }
    } catch (error) {
      console.error(`Error polling Egoli for ${injLead.email}: ${error}`);
      errors++;
    }
  }

  return { updated, errors };
}

// Poll Enigma/RevDale for injection_leads using bulk API
async function pollEnigmaInjectionLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: { id: string; name: string; api_key: string; url: string | null; status_endpoint: string | null },
  injectionLeads: { id: string; email: string; external_lead_id: string | null; is_ftd: boolean; sale_status: string | null }[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  const baseUrl = advertiser.status_endpoint || advertiser.url;
  if (!baseUrl) {
    console.log(`Enigma advertiser ${advertiser.name} has no URL configured for injection polling`);
    return { updated: 0, errors: 0 };
  }

  // Build the status URL
  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}/api/v2/leads`;
  } catch {
    console.log(`Invalid URL for Enigma advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  // Get date range - poll leads from last 30 days
  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const url = new URL(statusUrl);
  url.searchParams.set('fromDate', formatEnigmaDate(fromDate));
  url.searchParams.set('toDate', formatEnigmaDate(toDate));
  url.searchParams.set('itemsPerPage', '1000');

  console.log(`Enigma injection polling URL: ${url.toString()}`);
  console.log(`Routing through VPS forwarder with GET method`);

  try {
    // Route through VPS forwarder for IP whitelisting
    const authHeaderName = String(advertiser.config?.auth_header_name || 'Api-Key');
    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'X-Target-Url': url.toString(),
        'X-Http-Method': 'GET',
        [authHeaderName]: advertiser.api_key || '',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Enigma injection polling failed: ${response.status}, body: ${errorText}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    console.log(`Enigma returned ${data.items?.length || 0} leads for injection polling`);

    if (!data.items || !Array.isArray(data.items)) {
      console.log('Enigma response has no items array');
      return { updated: 0, errors: 0 };
    }

    // Create maps for matching by leadRequestIDEncoded and email
    const enigmaByLeadId = new Map<string, EnigmaLeadItem>();
    const enigmaByEmail = new Map<string, EnigmaLeadItem>();
    for (const item of data.items as EnigmaLeadItem[]) {
      if (item.leadRequestIDEncoded) {
        enigmaByLeadId.set(item.leadRequestIDEncoded, item);
      }
      // Also check if there's an email field for fallback matching
      if ((item as any).email) {
        enigmaByEmail.set((item as any).email.toLowerCase(), item);
      }
    }

    console.log(`Mapped ${enigmaByLeadId.size} Enigma leads by ID, ${enigmaByEmail.size} by email`);
    
    // Log what we're looking for
    const lookingFor = injectionLeads.map(l => `${l.email} (${l.external_lead_id})`).join(', ');
    console.log(`Looking for: ${lookingFor}`);

    // Match injection leads
    for (const injLead of injectionLeads) {
      // Try to match by external_lead_id first
      let enigmaLead = injLead.external_lead_id ? enigmaByLeadId.get(injLead.external_lead_id) : null;
      
      // Fallback to email matching
      if (!enigmaLead) {
        enigmaLead = enigmaByEmail.get(injLead.email.toLowerCase());
      }

      if (enigmaLead) {
        console.log(`Enigma match for ${injLead.email}: hasFTD=${enigmaLead.hasFTD}, saleStatus=${enigmaLead.saleStatus}`);

        const hasFtd = enigmaLead.hasFTD === 1 || enigmaLead.hasFTD === true;
        const leadUpdates: Record<string, unknown> = {};

        // Store raw status
        if (enigmaLead.saleStatus && enigmaLead.saleStatus !== injLead.sale_status) {
          leadUpdates.sale_status = enigmaLead.saleStatus;
          console.log(`Injection lead ${injLead.email} sale_status updated: ${enigmaLead.saleStatus}`);
          // Log status change to history
          await logStatusChange(supabase, null, injLead.id, 'sale_status', injLead.sale_status, enigmaLead.saleStatus);
        }

        // Check FTD
        if (hasFtd && !injLead.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = enigmaLead.signupDate || new Date().toISOString();
          console.log(`Injection lead ${injLead.email} FTD detected`);
          // Log FTD status change to history
          await logStatusChange(supabase, null, injLead.id, 'is_ftd', 'false', 'true');
        }

        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('injection_leads')
            .update(leadUpdates)
            .eq('id', injLead.id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling Enigma for injections: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Poll GSI Markets leads using their bulk leads_status API
async function pollGSILeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: LeadDistribution['advertisers'],
  distributions: LeadDistribution[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  const config = advertiser.config as Record<string, unknown> || {};
  const gsiId = String(config.gsi_id || '');
  const gsiHash = String(config.gsi_hash || '');

  if (!gsiId || !gsiHash) {
    console.log(`GSI advertiser ${advertiser.name} missing gsi_id or gsi_hash`);
    return { updated: 0, errors: 0 };
  }

  // Build the status URL
  const baseUrl = advertiser.url || 'https://www.gsimarkets.com/api_add2.php';
  const statusUrl = `${baseUrl}?act=leads_status&id=${encodeURIComponent(gsiId)}&hash=${encodeURIComponent(gsiHash)}`;

  console.log(`GSI bulk status URL: ${statusUrl}`);
  console.log(`Routing through VPS forwarder: ${FORWARDER_URL}`);

  try {
    const response = await fetch(FORWARDER_URL, {
      method: 'GET',
      headers: {
        'X-Target-Url': statusUrl,
      },
    });

    if (!response.ok) {
      console.log(`GSI bulk status check failed: ${response.status}`);
      return { updated: 0, errors: 1 };
    }

    const text = await response.text();
    console.log(`GSI raw response: ${text.substring(0, 500)}`);

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.log('GSI response is not JSON');
      return { updated: 0, errors: 0 };
    }

    // GSI may return leads in various formats
    const leads = Array.isArray(data) ? data : (data.leads || data.data || data.items || []);
    console.log(`GSI returned ${leads.length} leads`);

    if (!Array.isArray(leads) || leads.length === 0) {
      return { updated: 0, errors: 0 };
    }

    // Create maps for quick lookup by various ID fields
    const gsiLeadsById = new Map<string, any>();
    const gsiLeadsByEmail = new Map<string, any>();
    for (const item of leads) {
      if (item.id) gsiLeadsById.set(String(item.id), item);
      if (item.lead_id) gsiLeadsById.set(String(item.lead_id), item);
      if (item.email) gsiLeadsByEmail.set(item.email.toLowerCase(), item);
    }

    console.log(`Mapped ${gsiLeadsById.size} GSI leads by ID, ${gsiLeadsByEmail.size} by email`);

    // Match our distributions with GSI leads
    for (const dist of distributions) {
      // Update last_polled_at regardless of match
      await supabase
        .from('lead_distributions')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', dist.id);

      // Try to find matching GSI lead
      let gsiLead = null;
      if (dist.external_lead_id) {
        gsiLead = gsiLeadsById.get(dist.external_lead_id);
      }
      if (!gsiLead && dist.leads?.email) {
        gsiLead = gsiLeadsByEmail.get((dist.leads as any).email.toLowerCase());
      }

      if (gsiLead) {
        console.log(`GSI data for ${dist.external_lead_id || dist.leads?.email}: status=${gsiLead.status || gsiLead.sale_status}, ftd=${gsiLead.is_ftd || gsiLead.ftd || gsiLead.hasFTD}`);

        const hasFtd = gsiLead.is_ftd === 1 || gsiLead.is_ftd === true || 
                       gsiLead.ftd === 1 || gsiLead.ftd === true ||
                       gsiLead.hasFTD === 1 || gsiLead.hasFTD === true;
        const leadUpdates: Record<string, unknown> = {};

        // Store raw sale_status
        const rawStatus = gsiLead.status || gsiLead.sale_status;
        const oldSaleStatus = (dist.leads as any).sale_status;
        if (rawStatus && rawStatus !== oldSaleStatus) {
          leadUpdates.sale_status = rawStatus;
          console.log(`Sale status updated for lead ${dist.lead_id}: ${rawStatus}`);
          // Log status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'sale_status', oldSaleStatus, rawStatus);
        }

        // Check if FTD status changed
        if (hasFtd && !dist.leads.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = gsiLead.ftd_date || gsiLead.deposit_date || new Date().toISOString();
          console.log(`FTD detected for lead ${dist.lead_id}`);
          // Log FTD status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'is_ftd', 'false', 'true');

          // Update conversion stats
          const { data: existingConversion } = await supabase
            .from('advertiser_conversions')
            .select('id, conversion')
            .eq('advertiser_id', dist.advertiser_id)
            .maybeSingle();

          if (existingConversion) {
            const conversionData = existingConversion as { id: string; conversion: number };
            await supabase
              .from('advertiser_conversions')
              .update({ conversion: conversionData.conversion + 1 })
              .eq('id', conversionData.id);
          }
        }

        // Apply updates if any
        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('leads')
            .update(leadUpdates)
            .eq('id', dist.lead_id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling GSI: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Poll GSI for injection_leads
async function pollGSIInjectionLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: { id: string; name: string; url: string | null; config?: Record<string, unknown> },
  injectionLeads: { id: string; email: string; external_lead_id: string | null; is_ftd: boolean; sale_status: string | null }[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  const config = advertiser.config || {};
  const gsiId = String(config.gsi_id || '');
  const gsiHash = String(config.gsi_hash || '');

  if (!gsiId || !gsiHash) {
    console.log(`GSI advertiser ${advertiser.name} missing gsi_id or gsi_hash for injection polling`);
    return { updated: 0, errors: 0 };
  }

  const baseUrl = advertiser.url || 'https://www.gsimarkets.com/api_add2.php';
  const statusUrl = `${baseUrl}?act=leads_status&id=${encodeURIComponent(gsiId)}&hash=${encodeURIComponent(gsiHash)}`;

  console.log(`GSI injection polling URL: ${statusUrl}`);

  try {
    const response = await fetch(FORWARDER_URL, {
      method: 'GET',
      headers: {
        'X-Target-Url': statusUrl,
      },
    });

    if (!response.ok) {
      console.log(`GSI injection polling failed: ${response.status}`);
      return { updated: 0, errors: 1 };
    }

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { updated: 0, errors: 0 };
    }

    const leads = Array.isArray(data) ? data : (data.leads || data.data || data.items || []);
    console.log(`GSI returned ${leads.length} leads for injection polling`);

    // Map by email and ID
    const gsiByEmail = new Map<string, any>();
    const gsiById = new Map<string, any>();
    for (const item of leads) {
      if (item.email) gsiByEmail.set(item.email.toLowerCase(), item);
      if (item.id) gsiById.set(String(item.id), item);
      if (item.lead_id) gsiById.set(String(item.lead_id), item);
    }

    // Match injection leads
    for (const injLead of injectionLeads) {
      let gsiLead = gsiByEmail.get(injLead.email.toLowerCase());
      if (!gsiLead && injLead.external_lead_id) {
        gsiLead = gsiById.get(injLead.external_lead_id);
      }

      if (gsiLead) {
        console.log(`GSI match for ${injLead.email}: status=${gsiLead.status || gsiLead.sale_status}, ftd=${gsiLead.is_ftd || gsiLead.ftd}`);

        const hasFtd = gsiLead.is_ftd === 1 || gsiLead.is_ftd === true ||
                       gsiLead.ftd === 1 || gsiLead.ftd === true ||
                       gsiLead.hasFTD === 1 || gsiLead.hasFTD === true;
        const leadUpdates: Record<string, unknown> = {};

        const rawStatus = gsiLead.status || gsiLead.sale_status;
        if (rawStatus && String(rawStatus) !== String(injLead.sale_status)) {
          leadUpdates.sale_status = String(rawStatus);
          console.log(`Injection lead ${injLead.email} sale_status updated: ${rawStatus}`);
          // Log status change to history
          await logStatusChange(supabase, null, injLead.id, 'sale_status', injLead.sale_status, String(rawStatus));
        }

        if (hasFtd && !injLead.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = gsiLead.ftd_date || gsiLead.deposit_date || new Date().toISOString();
          console.log(`Injection lead ${injLead.email} FTD detected`);
          // Log FTD status change to history
          await logStatusChange(supabase, null, injLead.id, 'is_ftd', 'false', 'true');
        }

        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('injection_leads')
            .update(leadUpdates)
            .eq('id', injLead.id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling GSI for injections: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Format date for TrackBox API (YYYY-MM-DD HH:mm:ss)
function formatTrackBoxDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Poll TrackBox using their bulk pull/customers API
async function pollTrackBoxLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: LeadDistribution['advertisers'],
  distributions: LeadDistribution[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  // Get base URL from advertiser
  const baseUrl = advertiser.url;
  if (!baseUrl) {
    console.log(`TrackBox advertiser ${advertiser.name} has no URL configured`);
    return { updated: 0, errors: 0 };
  }

  // Build the status URL
  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}${advertiser.status_endpoint || '/api/pull/customers'}`;
  } catch {
    console.log(`Invalid URL for TrackBox advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  // Get TrackBox credentials from config
  const config = advertiser.config as Record<string, unknown> || {};
  const username = String(config.username || '');
  const password = String(config.password || '');

  if (!username || !password) {
    console.log(`TrackBox advertiser ${advertiser.name} missing username/password in config`);
    return { updated: 0, errors: 0 };
  }

  // Get date range - poll leads from last 30 days
  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Build request body per TrackBox API spec
  const requestBody = {
    from: formatTrackBoxDate(fromDate),
    to: formatTrackBoxDate(toDate),
    type: "3", // Leads + Deposits
    page: "0"
  };

  console.log(`TrackBox bulk status URL: ${statusUrl}`);
  console.log(`TrackBox request body: ${JSON.stringify(requestBody)}`);

  // TrackBox pull API may use different API key than push
  const apiKeyGet = String(config.api_key_get || advertiser.api_key || '');
  
  try {
    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trackbox-username': username,
        'x-trackbox-password': password,
        'x-api-key': apiKeyGet,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`TrackBox response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`TrackBox bulk status check failed: ${response.status}, body: ${errorText}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    console.log(`TrackBox returned status: ${data.status}, message: ${data.message || 'none'}`);

    // TrackBox returns { status: true/false, data: [...customers...] }
    if (!data.status) {
      console.log(`TrackBox API error: ${data.message || 'Unknown error'}`);
      return { updated: 0, errors: 1 };
    }

    const customers = data.data || [];
    console.log(`TrackBox returned ${customers.length} customers`);
    
    // Log first customer's keys for debugging
    if (customers.length > 0) {
      console.log(`TrackBox customer sample keys: ${Object.keys(customers[0]).join(', ')}`);
      console.log(`TrackBox customer sample: ${JSON.stringify(customers[0])}`);
    }

    if (!Array.isArray(customers) || customers.length === 0) {
      console.log('TrackBox response has no customers');
      return { updated: 0, errors: 0 };
    }

    // Create maps for quick lookup by customer_id and email
    // TrackBox response has nested structure: { customerData: {...}, tracking: {...} }
    const trackBoxByCustomerId = new Map<string, any>();
    const trackBoxByEmail = new Map<string, any>();
    for (const item of customers) {
      // Extract actual customer data from nested structure
      const customer = item.customerData || item;
      
      if (customer.customer_id) {
        trackBoxByCustomerId.set(String(customer.customer_id), customer);
      }
      if (customer.uniqueid) {
        trackBoxByCustomerId.set(String(customer.uniqueid), customer);
      }
      if (customer.email) {
        trackBoxByEmail.set(customer.email.toLowerCase(), customer);
      }
    }

    console.log(`Mapped ${trackBoxByCustomerId.size} TrackBox customers by ID, ${trackBoxByEmail.size} by email`);

    // Match our distributions with TrackBox customers
    for (const dist of distributions) {
      // Update last_polled_at regardless of match
      await supabase
        .from('lead_distributions')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', dist.id);

      // Try to find matching TrackBox customer
      let customer = null;
      if (dist.external_lead_id) {
        customer = trackBoxByCustomerId.get(dist.external_lead_id);
      }
      if (!customer && (dist.leads as any)?.email) {
        customer = trackBoxByEmail.get((dist.leads as any).email.toLowerCase());
      }

      if (customer) {
        // TrackBox uses: call_status for status, depositor (0/1) for FTD
        console.log(`TrackBox match for ${dist.external_lead_id || (dist.leads as any)?.email}: call_status=${customer.call_status}, depositor=${customer.depositor}`);

        const hasFtd = customer.depositor === 1 || customer.depositor === true ||
                       customer.ftd === 1 || customer.is_ftd === 1;
        const leadUpdates: Record<string, unknown> = {};

        // Store raw status - TrackBox uses call_status field
        const rawStatus = customer.call_status || customer.sale_status || customer.status;
        const oldSaleStatus = (dist.leads as any).sale_status;
        if (rawStatus && rawStatus !== oldSaleStatus) {
          leadUpdates.sale_status = rawStatus;
          console.log(`Sale status updated for lead ${dist.lead_id}: ${rawStatus}`);
          // Log status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'sale_status', oldSaleStatus, rawStatus);
        }

        // Check if FTD status changed
        if (hasFtd && !dist.leads.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = customer.ftd_date || customer.deposit_date || new Date().toISOString();
          console.log(`FTD detected for lead ${dist.lead_id}`);
          // Log FTD status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'is_ftd', 'false', 'true');

          // Update conversion stats
          const { data: existingConversion } = await supabase
            .from('advertiser_conversions')
            .select('id, conversion')
            .eq('advertiser_id', dist.advertiser_id)
            .maybeSingle();

          if (existingConversion) {
            const conversionData = existingConversion as { id: string; conversion: number };
            await supabase
              .from('advertiser_conversions')
              .update({ conversion: conversionData.conversion + 1 })
              .eq('id', conversionData.id);
          }
        }

        // Apply updates if any
        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('leads')
            .update(leadUpdates)
            .eq('id', dist.lead_id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling TrackBox: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Poll TrackBox for injection_leads
async function pollTrackBoxInjectionLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: { id: string; name: string; api_key: string; url: string | null; status_endpoint: string | null; config?: Record<string, unknown> },
  injectionLeads: { id: string; email: string; external_lead_id: string | null; is_ftd: boolean; sale_status: string | null }[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  const baseUrl = advertiser.url;
  if (!baseUrl) {
    console.log(`TrackBox advertiser ${advertiser.name} has no URL configured for injection polling`);
    return { updated: 0, errors: 0 };
  }

  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}${advertiser.status_endpoint || '/api/pull/customers'}`;
  } catch {
    console.log(`Invalid URL for TrackBox advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  const config = advertiser.config || {};
  const username = String(config.username || '');
  const password = String(config.password || '');

  if (!username || !password) {
    console.log(`TrackBox advertiser ${advertiser.name} missing credentials for injection polling`);
    return { updated: 0, errors: 0 };
  }

  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const requestBody = {
    from: formatTrackBoxDate(fromDate),
    to: formatTrackBoxDate(toDate),
    type: "3",
    page: "0"
  };

  // TrackBox pull API may use different API key than push
  const apiKeyGet = String(config.api_key_get || advertiser.api_key || '');
  
  console.log(`TrackBox injection polling URL: ${statusUrl}`);

  try {
    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trackbox-username': username,
        'x-trackbox-password': password,
        'x-api-key': apiKeyGet,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.log(`TrackBox injection polling failed: ${response.status}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    
    if (!data.status) {
      console.log(`TrackBox injection API error: ${data.message || 'Unknown'}`);
      return { updated: 0, errors: 1 };
    }

    const customers = data.data || [];
    console.log(`TrackBox returned ${customers.length} customers for injection polling`);

    // Map by email and customer_id - TrackBox has nested structure
    const trackBoxByEmail = new Map<string, any>();
    const trackBoxById = new Map<string, any>();
    for (const item of customers) {
      const customer = item.customerData || item;
      if (customer.email) trackBoxByEmail.set(customer.email.toLowerCase(), customer);
      if (customer.customer_id) trackBoxById.set(String(customer.customer_id), customer);
      if (customer.uniqueid) trackBoxById.set(String(customer.uniqueid), customer);
    }

    // Match injection leads
    for (const injLead of injectionLeads) {
      let customer = trackBoxByEmail.get(injLead.email.toLowerCase());
      if (!customer && injLead.external_lead_id) {
        customer = trackBoxById.get(injLead.external_lead_id);
      }

      if (customer) {
        // TrackBox uses: call_status for status, depositor (0/1) for FTD
        console.log(`TrackBox match for ${injLead.email}: call_status=${customer.call_status}, depositor=${customer.depositor}`);

        const hasFtd = customer.depositor === 1 || customer.depositor === true ||
                       customer.ftd === 1 || customer.is_ftd === 1;
        const leadUpdates: Record<string, unknown> = {};

        const rawStatus = customer.call_status || customer.sale_status || customer.status;
        if (rawStatus && String(rawStatus) !== String(injLead.sale_status)) {
          leadUpdates.sale_status = String(rawStatus);
          console.log(`Injection lead ${injLead.email} sale_status updated: ${rawStatus}`);
          // Log status change to history
          await logStatusChange(supabase, null, injLead.id, 'sale_status', injLead.sale_status, String(rawStatus));
        }

        if (hasFtd && !injLead.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = customer.ftd_date || customer.deposit_date || new Date().toISOString();
          console.log(`Injection lead ${injLead.email} FTD detected`);
          // Log FTD status change to history
          await logStatusChange(supabase, null, injLead.id, 'is_ftd', 'false', 'true');
        }

        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('injection_leads')
            .update(leadUpdates)
            .eq('id', injLead.id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling TrackBox for injections: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Format date for ELNOPY API (YYYY-MM-DD HH:mm:ss)
function formatElnopyDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Poll ELNOPY using their bulk leads API
async function pollElnopyLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: LeadDistribution['advertisers'],
  distributions: LeadDistribution[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  // Get base URL from config
  const baseUrl = advertiser.url;
  if (!baseUrl) {
    console.log(`ELNOPY advertiser ${advertiser.name} has no URL configured`);
    return { updated: 0, errors: 0 };
  }

  // Get API token from config
  const config = advertiser.config as Record<string, unknown> || {};
  const apiToken = String(config.api_token || advertiser.api_key || '');
  
  if (!apiToken) {
    console.log(`ELNOPY advertiser ${advertiser.name} has no API token configured`);
    return { updated: 0, errors: 0 };
  }

  // Build the status URL - ELNOPY uses /api/v3/get-leads endpoint
  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}/api/v3/get-leads`;
  } catch {
    console.log(`Invalid URL for ELNOPY advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  // Get date range - poll leads from last 30 days
  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const url = new URL(statusUrl);
  url.searchParams.set('api_token', apiToken);
  url.searchParams.set('from', formatElnopyDate(fromDate));
  url.searchParams.set('to', formatElnopyDate(toDate));
  url.searchParams.set('limit', '1000');

  console.log(`ELNOPY bulk status URL: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`ELNOPY bulk status check failed: ${response.status}, body: ${errorText}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    console.log(`ELNOPY returned ${data.data?.length || 0} leads`);

    if (!data.data || !Array.isArray(data.data)) {
      console.log('ELNOPY response has no data array');
      return { updated: 0, errors: 0 };
    }

    // Create a map of lead_id -> lead data for quick lookup
    const elnopyLeadsMap = new Map<string, ElnopyLeadItem>();
    for (const item of data.data as ElnopyLeadItem[]) {
      if (item.id) {
        elnopyLeadsMap.set(String(item.id), item);
      }
    }

    console.log(`Mapped ${elnopyLeadsMap.size} ELNOPY leads for matching`);

    // Match our distributions with ELNOPY leads
    for (const dist of distributions) {
      if (!dist.external_lead_id) continue;

      const elnopyLead = elnopyLeadsMap.get(dist.external_lead_id);
      
      // Update last_polled_at regardless of match
      await supabase
        .from('lead_distributions')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', dist.id);

      if (elnopyLead) {
        // Log raw ELNOPY data for debugging
        console.log(`ELNOPY data for ${dist.external_lead_id}: acq=${elnopyLead.acq}, status=${elnopyLead.status}`);
        
        // acq = 1 means FTD/Acquisition
        const hasFtd = elnopyLead.acq === 1;
        const leadUpdates: Record<string, unknown> = {};

        // Always store raw status from advertiser
        const oldSaleStatus = (dist.leads as any).sale_status;
        if (elnopyLead.status && elnopyLead.status !== oldSaleStatus) {
          leadUpdates.sale_status = elnopyLead.status;
          console.log(`Sale status updated for lead ${dist.lead_id}: ${elnopyLead.status}`);
          // Log status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'sale_status', oldSaleStatus, elnopyLead.status);
        }

        // Check if FTD status changed
        if (hasFtd && !dist.leads.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = elnopyLead.created_at || new Date().toISOString();
          console.log(`FTD detected for lead ${dist.lead_id} (ELNOPY ID: ${dist.external_lead_id})`);
          // Log FTD status change to history
          await logStatusChange(supabase, dist.lead_id, null, 'is_ftd', 'false', 'true');

          // Update conversion stats
          const { data: existingConversion } = await supabase
            .from('advertiser_conversions')
            .select('id, conversion')
            .eq('advertiser_id', dist.advertiser_id)
            .maybeSingle();

          if (existingConversion) {
            const conversionData = existingConversion as { id: string; conversion: number };
            await supabase
              .from('advertiser_conversions')
              .update({ conversion: conversionData.conversion + 1 })
              .eq('id', conversionData.id);
          }
        }

        // Apply updates if any
        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('leads')
            .update(leadUpdates)
            .eq('id', dist.lead_id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling ELNOPY: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Poll ELNOPY for injection_leads
async function pollElnopyInjectionLeads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  advertiser: { id: string; name: string; api_key: string; url: string | null; config?: Record<string, unknown> },
  injectionLeads: { id: string; email: string; external_lead_id: string | null; is_ftd: boolean; sale_status: string | null }[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  const baseUrl = advertiser.url;
  if (!baseUrl) {
    console.log(`ELNOPY advertiser ${advertiser.name} has no URL configured for injection polling`);
    return { updated: 0, errors: 0 };
  }

  const config = advertiser.config || {};
  const apiToken = String(config.api_token || advertiser.api_key || '');
  
  if (!apiToken) {
    console.log(`ELNOPY advertiser ${advertiser.name} has no API token for injection polling`);
    return { updated: 0, errors: 0 };
  }

  let statusUrl: string;
  try {
    const urlObj = new URL(baseUrl);
    statusUrl = `${urlObj.origin}/api/v3/get-leads`;
  } catch {
    console.log(`Invalid URL for ELNOPY advertiser: ${baseUrl}`);
    return { updated: 0, errors: 0 };
  }

  const toDate = new Date();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const url = new URL(statusUrl);
  url.searchParams.set('api_token', apiToken);
  url.searchParams.set('from', formatElnopyDate(fromDate));
  url.searchParams.set('to', formatElnopyDate(toDate));
  url.searchParams.set('limit', '1000');

  console.log(`ELNOPY injection polling URL: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`ELNOPY injection polling failed: ${response.status}`);
      return { updated: 0, errors: 1 };
    }

    const data = await response.json();
    console.log(`ELNOPY returned ${data.data?.length || 0} leads for injection polling`);

    if (!data.data || !Array.isArray(data.data)) {
      return { updated: 0, errors: 0 };
    }

    // Map by ID
    const elnopyById = new Map<string, ElnopyLeadItem>();
    for (const item of data.data as ElnopyLeadItem[]) {
      if (item.id) {
        elnopyById.set(String(item.id), item);
      }
    }

    // Match injection leads
    for (const injLead of injectionLeads) {
      if (!injLead.external_lead_id) continue;

      const elnopyLead = elnopyById.get(injLead.external_lead_id);

      if (elnopyLead) {
        console.log(`ELNOPY match for ${injLead.email}: acq=${elnopyLead.acq}, status=${elnopyLead.status}`);

        const hasFtd = elnopyLead.acq === 1;
        const leadUpdates: Record<string, unknown> = {};

        if (elnopyLead.status && String(elnopyLead.status) !== String(injLead.sale_status)) {
          leadUpdates.sale_status = String(elnopyLead.status);
          console.log(`Injection lead ${injLead.email} sale_status updated: ${elnopyLead.status}`);
          // Log status change to history
          await logStatusChange(supabase, null, injLead.id, 'sale_status', injLead.sale_status, String(elnopyLead.status));
        }

        if (hasFtd && !injLead.is_ftd) {
          leadUpdates.is_ftd = true;
          leadUpdates.ftd_date = elnopyLead.created_at || new Date().toISOString();
          console.log(`Injection lead ${injLead.email} FTD detected`);
          // Log FTD status change to history
          await logStatusChange(supabase, null, injLead.id, 'is_ftd', 'false', 'true');
        }

        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from('injection_leads')
            .update(leadUpdates)
            .eq('id', injLead.id);
          updated++;
        }
      }
    }
  } catch (error) {
    console.error(`Error polling ELNOPY for injections: ${error}`);
    errors++;
  }

  return { updated, errors };
}

// Status polling adapters for each advertiser type (non-Enigma/EliteCRM) - ALL route through VPS forwarder
const statusPollers: Record<string, (distribution: LeadDistribution) => Promise<StatusResponse | null>> = {
  
  // Trackbox status check
  trackbox: async (distribution) => {
    const advertiser = distribution.advertisers;
    if (!advertiser.status_endpoint || !distribution.external_lead_id) return null;

    // Build full URL: base domain + status_endpoint + customer ID
    const baseUrl = advertiser.url || '';
    let origin = '';
    try {
      const urlObj = new URL(baseUrl);
      origin = urlObj.origin;
    } catch {
      console.log(`Invalid base URL for TrackBox: ${baseUrl}`);
      return null;
    }
    
    const targetUrl = `${origin}${advertiser.status_endpoint}`;
    console.log(`TrackBox status polling: ${targetUrl}`);
    
    // TrackBox uses custom auth headers - send direct (no forwarder needed for status polling)
    const config = advertiser.config as Record<string, unknown> || {};
    const username = String(config.username || '');
    const password = String(config.password || '');
    
    // Build request body with customer_id filter
    const requestBody = {
      customer_id: distribution.external_lead_id
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trackbox-username': username,
        'x-trackbox-password': password,
        'x-api-key': advertiser.api_key || '',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`TrackBox response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`TrackBox polling error: ${errorText}`);
      return null;
    }
    
    const text = await response.text();
    console.log(`TrackBox response: ${text.substring(0, 500)}`);
    
    try {
      const data = JSON.parse(text);
      
      // TrackBox returns customers array with status info
      const customers = data.customers || data.data || [];
      if (Array.isArray(customers) && customers.length > 0) {
        const customer = customers[0];
        console.log(`TrackBox customer data: status=${customer.status}, ftd=${customer.ftd || customer.is_ftd}`);
        return {
          status: customer.sale_status || customer.status,
          is_ftd: customer.ftd === 1 || customer.is_ftd === 1 || customer.deposited === 1,
          ftd_date: customer.ftd_date || customer.deposit_date,
        };
      }
      
      // Single customer response
      if (data.customer_id || data.id) {
        return {
          status: data.sale_status || data.status,
          is_ftd: data.ftd === 1 || data.is_ftd === 1 || data.deposited === 1,
          ftd_date: data.ftd_date || data.deposit_date,
        };
      }
      
      return null;
    } catch {
      return null;
    }
  },

  // DrMailer / Dr Tracker status check
  drmailer: async (distribution) => {
    const advertiser = distribution.advertisers;
    if (!advertiser.status_endpoint || !distribution.external_lead_id) return null;

    const targetUrl = `${advertiser.status_endpoint}?lead_id=${distribution.external_lead_id}`;
    console.log(`DrMailer status polling via forwarder: ${targetUrl}`);

    const authHeaderName = String(advertiser.config?.auth_header_name || 'Api-Key');
    const response = await fetch(FORWARDER_URL, {
      method: 'GET',
      headers: {
        'X-Target-Url': targetUrl,
        [authHeaderName]: advertiser.api_key,
      },
    });

    if (!response.ok) return null;
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return {
        status: data.lead_status,
        is_ftd: data.has_deposited,
        ftd_date: data.first_deposit_date,
      };
    } catch {
      return null;
    }
  },

  // Getlinked status check
  getlinked: async (distribution) => {
    const advertiser = distribution.advertisers;
    if (!advertiser.status_endpoint || !distribution.external_lead_id) return null;

    console.log(`Getlinked status polling via forwarder: ${advertiser.status_endpoint}`);

    const authHeaderName = String(advertiser.config?.auth_header_name || 'Api-Key');
    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-Url': advertiser.status_endpoint,
        [authHeaderName]: advertiser.api_key,
        'X-Content-Type': 'application/json',
      },
      body: JSON.stringify({ lead_id: distribution.external_lead_id }),
    });

    if (!response.ok) return null;
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return {
        status: data.status,
        is_ftd: data.ftd === true || data.ftd === 'yes',
        ftd_date: data.ftd_date,
      };
    } catch {
      return null;
    }
  },

  // Timelocal status check (same as Getlinked)
  timelocal: async (distribution) => {
    const advertiser = distribution.advertisers;
    if (!advertiser.status_endpoint || !distribution.external_lead_id) return null;

    console.log(`Timelocal status polling via forwarder: ${advertiser.status_endpoint}`);

    const authHeaderName = String(advertiser.config?.auth_header_name || 'Api-Key');
    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-Url': advertiser.status_endpoint,
        [authHeaderName]: advertiser.api_key,
        'X-Content-Type': 'application/json',
      },
      body: JSON.stringify({ lead_id: distribution.external_lead_id }),
    });

    if (!response.ok) return null;
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return {
        status: data.status,
        is_ftd: data.ftd === true || data.ftd === 'yes',
        ftd_date: data.ftd_date,
      };
    } catch {
      return null;
    }
  },

  // Custom/fallback status check
  custom: async (distribution) => {
    const advertiser = distribution.advertisers;
    if (!advertiser.status_endpoint || !distribution.external_lead_id) return null;

    // Try GET with lead_id as query param
    const url = new URL(advertiser.status_endpoint);
    url.searchParams.set('lead_id', distribution.external_lead_id);
    
    console.log(`Custom status polling via forwarder: ${url.toString()}`);

    const authHeaderName = String(advertiser.config?.auth_header_name || 'Api-Key');
    const response = await fetch(FORWARDER_URL, {
      method: 'GET',
      headers: {
        'X-Target-Url': url.toString(),
        [authHeaderName]: advertiser.api_key,
      },
    });

    if (!response.ok) return null;
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return {
        status: data.status,
        is_ftd: data.is_ftd || data.ftd || data.converted || data.deposited,
        ftd_date: data.ftd_date || data.deposit_date,
      };
    } catch {
      return null;
    }
  },

  // GSI Markets status check using leads_status API
  gsi: async (distribution) => {
    const advertiser = distribution.advertisers;
    const config = advertiser.config as Record<string, unknown> || {};
    const gsiId = String(config.gsi_id || '');
    const gsiHash = String(config.gsi_hash || '');
    
    if (!gsiId || !gsiHash || !distribution.external_lead_id) return null;

    // Build status URL with authentication
    const baseUrl = advertiser.url || 'https://www.gsimarkets.com/api_add2.php';
    const statusUrl = `${baseUrl}?act=leads_status&id=${encodeURIComponent(gsiId)}&hash=${encodeURIComponent(gsiHash)}`;
    
    console.log(`GSI status polling via forwarder: ${statusUrl}`);

    const response = await fetch(FORWARDER_URL, {
      method: 'GET',
      headers: {
        'X-Target-Url': statusUrl,
      },
    });

    if (!response.ok) return null;
    
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      // GSI returns an array of leads - find the matching one
      const leads = Array.isArray(data) ? data : (data.leads || data.data || []);
      const matchingLead = leads.find((l: any) => 
        String(l.id) === distribution.external_lead_id || 
        String(l.lead_id) === distribution.external_lead_id
      );
      
      if (matchingLead) {
        return {
          status: matchingLead.status || matchingLead.sale_status,
          is_ftd: matchingLead.is_ftd || matchingLead.ftd || matchingLead.hasFTD,
          ftd_date: matchingLead.ftd_date || matchingLead.deposit_date,
        };
      }
      return null;
    } catch {
      return null;
    }
  },
};

// Map advertiser status to our status enum
function mapStatus(externalStatus: string | undefined): string | null {
  if (!externalStatus) return null;
  
  const statusMap: Record<string, string> = {
    'new': 'new',
    'pending': 'new',
    'contacted': 'contacted',
    'called': 'contacted',
    'qualified': 'qualified',
    'interested': 'qualified',
    'converted': 'converted',
    'ftd': 'converted',
    'deposited': 'converted',
    'sale': 'converted',
    'lost': 'lost',
    'rejected': 'lost',
    'invalid': 'lost',
    'no_answer': 'contacted',
    'callback': 'contacted',
  };
  
  return statusMap[externalStatus.toLowerCase()] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for health check, force, and email parameters
    let forcePolling = false;
    let targetEmail: string | null = null;
    let body: { health_check?: boolean; force?: boolean; email?: string } = {};
    
    if (req.method === 'POST') {
      try {
        body = await req.json();
        
        // Health check support
        if (body?.health_check === true) {
          return new Response(JSON.stringify({ status: "ok", function: "poll-lead-status" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        forcePolling = body.force === true;
        targetEmail = body.email || null;
        console.log(`Force polling: ${forcePolling}, Target email: ${targetEmail}`);
      } catch {
        // No body or invalid JSON, continue with normal polling
      }
    }

    console.log('Starting lead status polling...');

    // Get distributions that need polling:
    // - Status is 'sent'
    // - Has external_lead_id
    // - Last polled more than 5 minutes ago (or never polled) - unless force is true
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let query = supabase
      .from('lead_distributions')
      .select(`
        id,
        lead_id,
        advertiser_id,
        external_lead_id,
        last_polled_at,
        created_at,
        leads!inner (id, email, firstname, lastname, status, is_ftd, sale_status),
        advertisers!inner (id, name, advertiser_type, api_key, status_endpoint, url, config)
      `)
      .eq('status', 'sent')
      .not('external_lead_id', 'is', null);

    // If targeting a specific email, filter by it
    if (targetEmail) {
      query = query.eq('leads.email', targetEmail);
    }
    
    // Skip time filter if force polling
    if (!forcePolling) {
      query = query.or(`last_polled_at.is.null,last_polled_at.lt.${fiveMinutesAgo}`);
    }
    
    const { data: distributions, error: distError } = await query.limit(100);

    if (distError) {
      console.error('Error fetching distributions:', distError);
      return new Response(
        JSON.stringify({ success: false, error: distError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalUpdated = 0;
    let totalErrors = 0;

    if (!distributions || distributions.length === 0) {
      console.log('No distributions to poll');
    } else {
      console.log(`Found ${distributions.length} distributions to poll`);

    // Group distributions by advertiser for efficient polling
    const byAdvertiser = new Map<string, LeadDistribution[]>();
    for (const dist of distributions as unknown as LeadDistribution[]) {
      const key = dist.advertiser_id;
      if (!byAdvertiser.has(key)) {
        byAdvertiser.set(key, []);
      }
      byAdvertiser.get(key)!.push(dist);
    }

    console.log(`Grouped into ${byAdvertiser.size} advertisers`);

    // Process each advertiser
    for (const [advertiserId, advDistributions] of byAdvertiser) {
      const advertiser = advDistributions[0].advertisers;
      const advertiserType = advertiser.advertiser_type;

      console.log(`Processing ${advDistributions.length} leads for ${advertiser.name} (${advertiserType})`);

      // Enigma/GetLinked uses bulk API
      if (advertiserType === 'enigma' || advertiserType === 'getlinked') {
        const result = await pollEnigmaLeads(supabase, advertiser, advDistributions);
        totalUpdated += result.updated;
        totalErrors += result.errors;
        continue;
      }

      // EliteCRM uses bulk API
      if (advertiserType === 'elitecrm') {
        const result = await pollEliteCRMLeads(supabase, advertiser, advDistributions);
        totalUpdated += result.updated;
        totalErrors += result.errors;
        continue;
      }

      // GSI Markets uses bulk API
      if (advertiserType === 'gsi') {
        const result = await pollGSILeads(supabase, advertiser, advDistributions);
        totalUpdated += result.updated;
        totalErrors += result.errors;
        continue;
      }

      // ELNOPY uses bulk API
      if (advertiserType === 'elnopy') {
        const result = await pollElnopyLeads(supabase, advertiser, advDistributions);
        totalUpdated += result.updated;
        totalErrors += result.errors;
        continue;
      }

      // TrackBox uses bulk API
      if (advertiserType === 'trackbox') {
        const result = await pollTrackBoxLeads(supabase, advertiser, advDistributions);
        totalUpdated += result.updated;
        totalErrors += result.errors;
        continue;
      }

      // Other advertisers use per-lead polling
      const poller = statusPollers[advertiserType] || statusPollers.custom;
      
      // Skip if no status_endpoint configured
      if (!advertiser.status_endpoint) {
        console.log(`Skipping ${advertiser.name} - no status_endpoint configured`);
        // Still update last_polled_at
        for (const dist of advDistributions) {
          await supabase
            .from('lead_distributions')
            .update({ last_polled_at: new Date().toISOString() })
            .eq('id', dist.id);
        }
        continue;
      }

      for (const dist of advDistributions) {
        try {
          console.log(`Polling ${advertiser.name} for lead ${dist.external_lead_id}`);
          
          const statusResult = await poller(dist);
          
          // Update last_polled_at regardless of result
          await supabase
            .from('lead_distributions')
            .update({ last_polled_at: new Date().toISOString() })
            .eq('id', dist.id);

          if (statusResult) {
            const leadUpdates: Record<string, unknown> = {};
            
            // Map and update status if changed
            const mappedStatus = mapStatus(statusResult.status);
            if (mappedStatus && mappedStatus !== dist.leads.status) {
              leadUpdates.status = mappedStatus;
              console.log(`Status changed for lead ${dist.lead_id}: ${dist.leads.status} -> ${mappedStatus}`);
            }
            
            // Update FTD if changed
            if (statusResult.is_ftd && !dist.leads.is_ftd) {
              leadUpdates.is_ftd = true;
              leadUpdates.ftd_date = statusResult.ftd_date || new Date().toISOString();
              console.log(`FTD detected for lead ${dist.lead_id}`);
              
              // Update conversion stats
              const { data: existingConversion } = await supabase
                .from('advertiser_conversions')
                .select('id, conversion')
                .eq('advertiser_id', dist.advertiser_id)
                .maybeSingle();

              if (existingConversion) {
                await supabase
                  .from('advertiser_conversions')
                  .update({ conversion: existingConversion.conversion + 1 })
                  .eq('id', existingConversion.id);
              }
            }
            
            // Apply updates if any
            if (Object.keys(leadUpdates).length > 0) {
              await supabase
                .from('leads')
                .update(leadUpdates)
                .eq('id', dist.lead_id);
              totalUpdated++;
            }
          }
        } catch (pollError) {
          console.error(`Error polling lead ${dist.lead_id}:`, pollError);
          totalErrors++;
        }
      }
    }
    } // end else - distributions processing

    console.log(`Lead distributions polling complete. Updated: ${totalUpdated}, Errors: ${totalErrors}`);

    // ===== POLL INJECTION LEADS =====
    console.log('Starting injection leads polling...');

    // Get sent injection leads that have external_lead_id
    const { data: injectionLeads, error: injError } = await supabase
      .from('injection_leads')
      .select(`
        id,
        email,
        external_lead_id,
        is_ftd,
        sale_status,
        advertiser_id,
        advertisers!inner (id, name, advertiser_type, api_key, url, status_endpoint)
      `)
      .eq('status', 'sent')
      .not('external_lead_id', 'is', null)
      .limit(500);

    if (injError) {
      console.error('Error fetching injection leads:', injError);
    } else if (injectionLeads && injectionLeads.length > 0) {
      console.log(`Found ${injectionLeads.length} injection leads to poll`);

      // Group by advertiser
      const injByAdvertiser = new Map<string, typeof injectionLeads>();
      for (const il of injectionLeads) {
        const key = il.advertiser_id;
        if (!key) continue;
        if (!injByAdvertiser.has(key)) {
          injByAdvertiser.set(key, []);
        }
        injByAdvertiser.get(key)!.push(il);
      }

      for (const [advId, advLeads] of injByAdvertiser) {
        const adv = (advLeads[0] as any).advertisers;
        if (adv.advertiser_type === 'elitecrm') {
          console.log(`Polling ${advLeads.length} injection leads for EliteCRM advertiser ${adv.name}`);
          const result = await pollEliteCRMInjectionLeads(
            supabase,
            adv,
            advLeads.map((l: any) => ({
              id: l.id,
              email: l.email,
              external_lead_id: l.external_lead_id,
              is_ftd: l.is_ftd,
              sale_status: l.sale_status,
            }))
          );
          totalUpdated += result.updated;
          totalErrors += result.errors;
        } else if (adv.advertiser_type === 'gsi') {
          console.log(`Polling ${advLeads.length} injection leads for GSI advertiser ${adv.name}`);
          const result = await pollGSIInjectionLeads(
            supabase,
            { ...adv, config: adv.config || {} },
            advLeads.map((l: any) => ({
              id: l.id,
              email: l.email,
              external_lead_id: l.external_lead_id,
              is_ftd: l.is_ftd,
              sale_status: l.sale_status,
            }))
          );
          totalUpdated += result.updated;
          totalErrors += result.errors;
        } else if (adv.advertiser_type === 'elnopy') {
          console.log(`Polling ${advLeads.length} injection leads for ELNOPY advertiser ${adv.name}`);
          const result = await pollElnopyInjectionLeads(
            supabase,
            { ...adv, config: adv.config || {} },
            advLeads.map((l: any) => ({
              id: l.id,
              email: l.email,
              external_lead_id: l.external_lead_id,
              is_ftd: l.is_ftd,
              sale_status: l.sale_status,
            }))
          );
          totalUpdated += result.updated;
          totalErrors += result.errors;
        } else if (adv.advertiser_type === 'trackbox') {
          console.log(`Polling ${advLeads.length} injection leads for TrackBox advertiser ${adv.name}`);
          const result = await pollTrackBoxInjectionLeads(
            supabase,
            { ...adv, config: adv.config || {} },
            advLeads.map((l: any) => ({
              id: l.id,
              email: l.email,
              external_lead_id: l.external_lead_id,
              is_ftd: l.is_ftd,
              sale_status: l.sale_status,
            }))
          );
          totalUpdated += result.updated;
          totalErrors += result.errors;
        } else if (adv.advertiser_type === 'enigma' || adv.advertiser_type === 'getlinked') {
          console.log(`Polling ${advLeads.length} injection leads for Enigma/GetLinked advertiser ${adv.name}`);
          const result = await pollEnigmaInjectionLeads(
            supabase,
            adv,
            advLeads.map((l: any) => ({
              id: l.id,
              email: l.email,
              external_lead_id: l.external_lead_id,
              is_ftd: l.is_ftd,
              sale_status: l.sale_status,
            }))
          );
          totalUpdated += result.updated;
          totalErrors += result.errors;
        }
        // Add other advertiser types here if needed
      }
    } else {
      console.log('No injection leads to poll');
    }

    console.log(`Total polling complete. Updated: ${totalUpdated}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Polling complete',
        polled: distributions.length,
        injectionLeadsPolled: injectionLeads?.length || 0,
        updated: totalUpdated,
        errors: totalErrors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
