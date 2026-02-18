import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Injection {
  id: string;
  name: string;
  advertiser_id: string;
  status: string;
  geo_caps: Record<string, number>;
  geo_caps_baseline: Record<string, number> | null; // Sent counts at resume time
  min_delay_seconds: number;
  max_delay_seconds: number;
  noise_level: string;
  working_start_time: string | null;
  working_end_time: string | null;
  working_days: string[];
  total_leads: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  next_scheduled_at: string | null;
  smart_mode: boolean;
  offer_name: string | null;
  traffic_simulation_state: TrafficSimulationState | null; // Traffic simulation state
}

interface InjectionLead {
  id: string;
  injection_id: string;
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  country_code: string;
  country: string | null;
  ip_address: string | null;
  offer_name: string | null;
  custom1: string | null;
  custom2: string | null;
  custom3: string | null;
  comment: string | null;
  status: string;
  scheduled_at: string | null;
  // Traffic simulation fields
  device_type: string | null;
  user_agent: string | null;
  browser_language: string | null;
  timezone: string | null;
  city: string | null;
  isp_name: string | null;
}

interface Advertiser {
  id: string;
  name: string;
  advertiser_type: string;
  url: string;
  api_key: string;
  config: Record<string, unknown>;
}

// VPS forwarder URL for IP whitelisting
const FORWARDER_URL = 'https://crm.alphatradecrm.com/proxy/forward.php';

// ============================================================================
// TRAFFIC SIMULATION ENGINE - Human-Like Traffic Generation
// ============================================================================

interface TrafficSimulationState {
  lastDeviceTypes: string[];        // Last 3 device types used
  lastUserAgents: string[];         // Last 3 UAs used
  currentCity: string | null;       // Current city cluster
  cityLeadsRemaining: number;       // 2-5 leads before city rotation
  currentIsp: string | null;        // Current ISP
  ispLeadsRemaining: number;        // 6-10 leads before ISP rotation
  usedIps: {                        // Rolling 7-day IP history for repeat visitors
    ip: string;
    usedAt: string;
  }[];
}

interface TrafficSimulationResult {
  deviceType: string;
  userAgent: string;
  browserLanguage: string;
  timezone: string;
  city: string;
  ispName: string;
  ipAddress: string;
}

// ============ DEVICE DISTRIBUTION (65% Mobile / 35% Desktop) ============

const DEVICE_PROFILES = {
  mobile: [
    { weight: 40, type: 'android_chrome', os: 'Android', browser: 'Chrome Mobile' },
    { weight: 25, type: 'iphone_safari', os: 'iOS', browser: 'Mobile Safari' },
  ],
  desktop: [
    { weight: 20, type: 'windows_chrome', os: 'Windows', browser: 'Chrome' },
    { weight: 15, type: 'mac_safari', os: 'macOS', browser: 'Safari' },
  ]
};

// ============ USER-AGENT LIBRARY (50+ Real UAs) ============

const USER_AGENT_LIBRARY: Record<string, string[]> = {
  // Android Chrome (15+ variants)
  android_chrome: [
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; RMX3686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; CPH2449) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; 22101316G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; moto g(60)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; Nokia 5.4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
  ],
  // iPhone Safari (15+ variants)
  iphone_safari: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.7 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.8 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.7 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ],
  // Windows Chrome (10+ variants)
  windows_chrome: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  ],
  // Mac Safari (10+ variants)
  mac_safari: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15',
  ],
};

// ============ CITY POOLS (for IP clustering) ============

const CITY_POOLS: Record<string, { city: string; ipPrefixes: string[] }[]> = {
  GB: [
    { city: 'London', ipPrefixes: ['2.24.', '2.25.', '5.64.', '31.48.'] },
    { city: 'Manchester', ipPrefixes: ['81.128.', '86.128.'] },
    { city: 'Birmingham', ipPrefixes: ['77.96.', '90.192.'] },
    { city: 'Leeds', ipPrefixes: ['84.64.', '88.96.'] },
    { city: 'Glasgow', ipPrefixes: ['80.192.', '82.128.'] },
  ],
  DE: [
    { city: 'Berlin', ipPrefixes: ['2.200.', '5.144.', '31.16.'] },
    { city: 'Munich', ipPrefixes: ['46.5.', '77.0.'] },
    { city: 'Hamburg', ipPrefixes: ['37.4.', '78.48.'] },
    { city: 'Frankfurt', ipPrefixes: ['79.192.', '80.64.'] },
    { city: 'Cologne', ipPrefixes: ['46.32.', '78.96.'] },
  ],
  FR: [
    { city: 'Paris', ipPrefixes: ['2.0.', '5.48.', '31.32.'] },
    { city: 'Lyon', ipPrefixes: ['78.192.', '80.8.'] },
    { city: 'Marseille', ipPrefixes: ['81.48.', '86.192.'] },
    { city: 'Toulouse', ipPrefixes: ['37.160.', '90.48.'] },
    { city: 'Nice', ipPrefixes: ['80.192.', '88.128.'] },
  ],
  ES: [
    { city: 'Madrid', ipPrefixes: ['2.136.', '5.152.', '31.4.'] },
    { city: 'Barcelona', ipPrefixes: ['37.120.', '79.144.'] },
    { city: 'Valencia', ipPrefixes: ['80.24.', '81.32.'] },
    { city: 'Seville', ipPrefixes: ['83.32.', '88.16.'] },
    { city: 'Bilbao', ipPrefixes: ['85.48.', '90.64.'] },
  ],
  IT: [
    { city: 'Rome', ipPrefixes: ['2.32.', '5.88.', '31.156.'] },
    { city: 'Milan', ipPrefixes: ['37.176.', '79.0.'] },
    { city: 'Naples', ipPrefixes: ['80.104.', '82.48.'] },
    { city: 'Turin', ipPrefixes: ['84.32.', '85.64.'] },
    { city: 'Florence', ipPrefixes: ['86.96.', '89.128.'] },
  ],
  NL: [
    { city: 'Amsterdam', ipPrefixes: ['2.56.', '5.132.', '31.148.'] },
    { city: 'Rotterdam', ipPrefixes: ['37.48.', '77.160.'] },
    { city: 'The Hague', ipPrefixes: ['80.56.', '82.136.'] },
    { city: 'Utrecht', ipPrefixes: ['84.80.', '86.64.'] },
    { city: 'Eindhoven', ipPrefixes: ['88.32.', '90.16.'] },
  ],
  PL: [
    { city: 'Warsaw', ipPrefixes: ['2.176.', '5.172.', '31.0.'] },
    { city: 'Krakow', ipPrefixes: ['37.47.', '77.64.'] },
    { city: 'Wroclaw', ipPrefixes: ['78.8.', '79.184.'] },
    { city: 'Poznan', ipPrefixes: ['80.48.', '81.96.'] },
    { city: 'Gdansk', ipPrefixes: ['83.24.', '85.16.'] },
  ],
  AU: [
    { city: 'Sydney', ipPrefixes: ['1.40.', '14.200.', '27.32.'] },
    { city: 'Melbourne', ipPrefixes: ['49.176.', '58.96.'] },
    { city: 'Brisbane', ipPrefixes: ['101.160.', '110.140.'] },
    { city: 'Perth', ipPrefixes: ['103.1.', '112.213.'] },
    { city: 'Adelaide', ipPrefixes: ['115.64.', '118.208.'] },
  ],
  CA: [
    { city: 'Toronto', ipPrefixes: ['24.48.', '24.64.', '70.24.', '99.234.'] },
    { city: 'Vancouver', ipPrefixes: ['99.224.', '174.88.', '207.6.'] },
    { city: 'Montreal', ipPrefixes: ['184.64.', '199.48.', '70.80.'] },
    { city: 'Calgary', ipPrefixes: ['68.144.', '75.155.', '209.139.'] },
    { city: 'Ottawa', ipPrefixes: ['76.64.', '99.240.', '205.150.'] },
    { city: 'Winnipeg', ipPrefixes: ['142.161.', '207.161.', '198.163.'] },
    { city: 'Edmonton', ipPrefixes: ['174.91.', '209.171.', '142.59.'] },
    { city: 'Saskatoon', ipPrefixes: ['142.165.', '198.169.'] },
  ],
  US: [
    { city: 'New York', ipPrefixes: ['8.8.', '12.0.', '23.0.'] },
    { city: 'Los Angeles', ipPrefixes: ['24.0.', '63.0.', '64.0.'] },
    { city: 'Chicago', ipPrefixes: ['65.0.', '66.0.', '67.0.'] },
    { city: 'Houston', ipPrefixes: ['68.48.', '70.128.'] },
    { city: 'Miami', ipPrefixes: ['72.64.', '76.32.'] },
  ],
  AR: [
    { city: 'Buenos Aires', ipPrefixes: ['181.164.', '181.165.', '190.16.', '190.17.'] },
    { city: 'Córdoba', ipPrefixes: ['181.166.', '190.18.', '200.45.'] },
    { city: 'Rosario', ipPrefixes: ['181.167.', '190.19.', '200.46.'] },
    { city: 'Mendoza', ipPrefixes: ['181.168.', '190.20.', '200.47.'] },
    { city: 'La Plata', ipPrefixes: ['181.169.', '190.21.'] },
  ],
};

// ============ ISP POOLS (for rotation) ============

const ISP_POOLS: Record<string, string[]> = {
  GB: ['BT', 'Virgin Media', 'Sky Broadband', 'TalkTalk', 'Vodafone UK', 'EE', 'Plusnet'],
  DE: ['Deutsche Telekom', 'Vodafone DE', '1&1', 'O2 Germany', 'Unitymedia', 'Congstar'],
  FR: ['Orange France', 'SFR', 'Free', 'Bouygues Telecom', 'Numericable', 'OVH'],
  ES: ['Movistar', 'Vodafone ES', 'Orange Spain', 'MasMovil', 'Jazztel', 'ONO'],
  IT: ['TIM', 'Vodafone IT', 'Wind Tre', 'Fastweb', 'Iliad IT', 'PosteMobile'],
  NL: ['KPN', 'Ziggo', 'T-Mobile NL', 'Tele2 NL', 'XS4ALL', 'Vodafone NL'],
  PL: ['Orange PL', 'Play', 'T-Mobile PL', 'Plus', 'UPC Polska', 'Vectra'],
  AU: ['Telstra', 'Optus', 'TPG', 'iiNet', 'Vodafone AU', 'Aussie Broadband'],
  CA: ['Rogers', 'Bell', 'Telus', 'Shaw', 'Videotron', 'Cogeco'],
  US: ['Comcast Xfinity', 'AT&T', 'Verizon', 'Spectrum', 'Cox', 'CenturyLink', 'T-Mobile'],
  AR: ['Telecom/Fibertel', 'Claro Argentina', 'Personal', 'Movistar Argentina', 'Telecentro', 'iPlan'],
};

// ============ LANGUAGE MAPPING ============

const LANGUAGE_MAP: Record<string, string> = {
  GB: 'en-GB,en;q=0.9',
  US: 'en-US,en;q=0.9',
  CA: 'en-CA,en;q=0.9,fr-CA;q=0.8',
  AU: 'en-AU,en;q=0.9',
  DE: 'de-DE,de;q=0.9,en;q=0.8',
  FR: 'fr-FR,fr;q=0.9,en;q=0.8',
  ES: 'es-ES,es;q=0.9,en;q=0.8',
  IT: 'it-IT,it;q=0.9,en;q=0.8',
  NL: 'nl-NL,nl;q=0.9,en;q=0.8',
  PL: 'pl-PL,pl;q=0.9,en;q=0.8',
  PT: 'pt-PT,pt;q=0.9,en;q=0.8',
  BR: 'pt-BR,pt;q=0.9,en;q=0.8',
  SE: 'sv-SE,sv;q=0.9,en;q=0.8',
  NO: 'nb-NO,no;q=0.9,en;q=0.8',
  DK: 'da-DK,da;q=0.9,en;q=0.8',
  FI: 'fi-FI,fi;q=0.9,en;q=0.8',
  AT: 'de-AT,de;q=0.9,en;q=0.8',
  CH: 'de-CH,de;q=0.9,fr-CH;q=0.8,en;q=0.7',
  BE: 'nl-BE,nl;q=0.9,fr-BE;q=0.8,en;q=0.7',
  IE: 'en-IE,en;q=0.9,ga;q=0.8',
  NZ: 'en-NZ,en;q=0.9',
  ZA: 'en-ZA,en;q=0.9,af;q=0.8',
  AR: 'es-AR,es;q=0.9,en;q=0.8',
};

// ============ TIMEZONE MAPPING ============

const TIMEZONE_MAP: Record<string, string | string[]> = {
  GB: 'Europe/London',
  US: ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver'],
  CA: ['America/Toronto', 'America/Vancouver', 'America/Montreal', 'America/Calgary'],
  AU: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth'],
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  PL: 'Europe/Warsaw',
  PT: 'Europe/Lisbon',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen',
  FI: 'Europe/Helsinki',
  AT: 'Europe/Vienna',
  CH: 'Europe/Zurich',
  BE: 'Europe/Brussels',
  IE: 'Europe/Dublin',
  NZ: 'Pacific/Auckland',
  ZA: 'Africa/Johannesburg',
  AR: 'America/Argentina/Buenos_Aires',
};

// ============ PHONE PREFIX MAP (for validation) ============

const PHONE_PREFIX_MAP: Record<string, string[]> = {
  GB: ['+44', '44', '0'],
  US: ['+1', '1'],
  CA: ['+1', '1'],
  AU: ['+61', '61', '0'],
  DE: ['+49', '49', '0'],
  FR: ['+33', '33', '0'],
  ES: ['+34', '34'],
  IT: ['+39', '39'],
  NL: ['+31', '31', '0'],
  PL: ['+48', '48'],
  AR: ['+54', '54'],
};

// ============ CANADIAN AREA CODE TO CITY MAPPING ============
// Maps Canadian phone area codes to cities for accurate IP geo-matching
const CA_AREA_CODE_TO_CITY: Record<string, string> = {
  // Ontario - Toronto (GTA)
  '416': 'Toronto', '647': 'Toronto', '437': 'Toronto',
  '905': 'Toronto', '289': 'Toronto', '365': 'Toronto',
  
  // Ontario - Ottawa
  '613': 'Ottawa', '343': 'Ottawa',
  
  // Quebec - Montreal
  '514': 'Montreal', '438': 'Montreal', '450': 'Montreal',
  '579': 'Montreal',
  
  // Quebec - Quebec City (map to Montreal - closest major city with IP pool)
  '418': 'Montreal', '581': 'Montreal', '367': 'Montreal',
  
  // British Columbia - Vancouver
  '604': 'Vancouver', '778': 'Vancouver', '236': 'Vancouver',
  '672': 'Vancouver',
  
  // British Columbia - Victoria (map to Vancouver)
  '250': 'Vancouver',
  
  // Alberta - Calgary
  '403': 'Calgary', '587': 'Calgary', '825': 'Calgary',
  
  // Alberta - Edmonton
  '780': 'Edmonton',
  
  // Manitoba - Winnipeg
  '204': 'Winnipeg', '431': 'Winnipeg',
  
  // Saskatchewan - Saskatoon/Regina
  '306': 'Saskatoon', '639': 'Saskatoon',
  
  // Atlantic provinces (map to closest major city)
  '902': 'Montreal', // Nova Scotia/PEI
  '709': 'Montreal', // Newfoundland
  '506': 'Montreal', // New Brunswick
};

// Helper function to extract city from Canadian phone number's area code
function getCityFromCanadianPhone(phone: string): string | null {
  // Normalize: strip +, spaces, dashes, parentheses
  const digits = phone.replace(/\D/g, '');
  
  // Canadian numbers: 1AAANNNNNNN (11 digits) or AAANNNNNNN (10 digits)
  let areaCode: string;
  if (digits.length === 11 && digits.startsWith('1')) {
    areaCode = digits.substring(1, 4);
  } else if (digits.length === 10) {
    areaCode = digits.substring(0, 3);
  } else {
    return null;
  }
  
  const city = CA_AREA_CODE_TO_CITY[areaCode];
  if (city) {
    console.log(`Canadian area code ${areaCode} -> ${city}`);
  }
  return city || null;
}

// ============ TRAFFIC SIMULATION FUNCTIONS ============

function selectDeviceType(state: TrafficSimulationState): { deviceType: string; deviceCategory: string } {
  // 65% mobile, 35% desktop
  const rand = cryptoRandom();
  const deviceCategory = rand < 0.65 ? 'mobile' : 'desktop';
  
  // Select specific device profile based on weight
  const profiles = DEVICE_PROFILES[deviceCategory as keyof typeof DEVICE_PROFILES];
  const totalWeight = profiles.reduce((sum, p) => sum + p.weight, 0);
  let pick = cryptoRandom() * totalWeight;
  
  let selectedType = profiles[0].type;
  for (const profile of profiles) {
    pick -= profile.weight;
    if (pick <= 0) {
      selectedType = profile.type;
      break;
    }
  }
  
  // Anti-pattern: Allow bursts of 2-4 same device types, but not perfect alternation
  const lastTypes = state.lastDeviceTypes || [];
  const sameTypeCount = lastTypes.filter(t => {
    const isMobile = ['android_chrome', 'iphone_safari'].includes(t);
    const selectedIsMobile = ['android_chrome', 'iphone_safari'].includes(selectedType);
    return isMobile === selectedIsMobile;
  }).length;
  
  // If we've had 4+ of the same category, force a switch
  if (sameTypeCount >= 4) {
    const oppositeCategory = deviceCategory === 'mobile' ? 'desktop' : 'mobile';
    const oppositeProfiles = DEVICE_PROFILES[oppositeCategory as keyof typeof DEVICE_PROFILES];
    selectedType = oppositeProfiles[Math.floor(cryptoRandom() * oppositeProfiles.length)].type;
  }
  
  return { deviceType: selectedType, deviceCategory };
}

function selectUserAgent(deviceType: string, state: TrafficSimulationState): string {
  const uas = USER_AGENT_LIBRARY[deviceType] || USER_AGENT_LIBRARY['android_chrome'];
  const lastUAs = state.lastUserAgents || [];
  
  // Filter out UAs used in last 3 sends
  const availableUAs = uas.filter(ua => !lastUAs.includes(ua));
  
  // If all UAs were recently used (shouldn't happen with 15+), use full list
  const pool = availableUAs.length > 0 ? availableUAs : uas;
  
  return pool[Math.floor(cryptoRandom() * pool.length)];
}

function selectCityAndIP(
  countryCode: string,
  state: TrafficSimulationState,
  phone?: string
): { city: string; ipAddress: string; ipPrefix: string } {
  const cityPool = CITY_POOLS[countryCode] || CITY_POOLS['US'];
  
  // For Canada: match area code to city for geo-fraud prevention
  if (countryCode === 'CA' && phone) {
    const targetCity = getCityFromCanadianPhone(phone);
    if (targetCity) {
      const matchingCity = cityPool.find(c => c.city === targetCity);
      if (matchingCity) {
        // Use IP from the matching city based on phone area code
        const prefix = matchingCity.ipPrefixes[
          Math.floor(cryptoRandom() * matchingCity.ipPrefixes.length)
        ];
        const octet3 = Math.floor(cryptoRandom() * 254) + 1;
        const octet4 = Math.floor(cryptoRandom() * 254) + 1;
        console.log(`Area code match: Phone -> ${targetCity}, using IP prefix ${prefix}`);
        return {
          city: matchingCity.city,
          ipAddress: `${prefix}${octet3}.${octet4}`,
          ipPrefix: prefix,
        };
      } else {
        console.warn(`City ${targetCity} from area code not found in pool, using random`);
      }
    }
  }
  
  // Default behavior for other countries or unknown area codes
  // Check if we should rotate city (or initialize)
  let currentCity = state.currentCity;
  let cityLeadsRemaining = state.cityLeadsRemaining || 0;
  
  if (!currentCity || cityLeadsRemaining <= 0) {
    // Select new city
    const cityData = cityPool[Math.floor(cryptoRandom() * cityPool.length)];
    currentCity = cityData.city;
    cityLeadsRemaining = 2 + Math.floor(cryptoRandom() * 4); // 2-5 leads per city
  }
  
  // Find the city's IP prefixes
  const cityData = cityPool.find(c => c.city === currentCity) || cityPool[0];
  const ipPrefix = cityData.ipPrefixes[Math.floor(cryptoRandom() * cityData.ipPrefixes.length)];
  
  // Generate IP with this prefix
  const octet3 = Math.floor(cryptoRandom() * 254) + 1;
  const octet4 = Math.floor(cryptoRandom() * 254) + 1;
  const ipAddress = `${ipPrefix}${octet3}.${octet4}`;
  
  return { city: currentCity, ipAddress, ipPrefix };
}

function selectISP(countryCode: string, state: TrafficSimulationState): string {
  const ispPool = ISP_POOLS[countryCode] || ISP_POOLS['US'];
  
  // Check if we should rotate ISP (every 6-10 leads)
  let currentIsp = state.currentIsp;
  let ispLeadsRemaining = state.ispLeadsRemaining || 0;
  
  if (!currentIsp || ispLeadsRemaining <= 0) {
    currentIsp = ispPool[Math.floor(cryptoRandom() * ispPool.length)];
    ispLeadsRemaining = 6 + Math.floor(cryptoRandom() * 5); // 6-10 leads per ISP
  }
  
  return currentIsp;
}

function checkRepeatIP(state: TrafficSimulationState): string | null {
  // 5-10% chance to reuse an IP from 24h+ ago (returning visitor pattern)
  const repeatChance = 0.05 + cryptoRandom() * 0.05; // 5-10%
  
  if (cryptoRandom() < repeatChance) {
    const usedIps = state.usedIps || [];
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // Find IPs used between 24h and 7 days ago
    const eligibleIps = usedIps.filter(entry => {
      const usedTime = new Date(entry.usedAt).getTime();
      return usedTime < oneDayAgo && usedTime > sevenDaysAgo;
    });
    
    if (eligibleIps.length > 0) {
      const selectedEntry = eligibleIps[Math.floor(cryptoRandom() * eligibleIps.length)];
      console.log(`Repeat IP selected (returning visitor pattern): ${selectedEntry.ip}`);
      return selectedEntry.ip;
    }
  }
  
  return null;
}

function getLanguage(countryCode: string): string {
  return LANGUAGE_MAP[countryCode] || LANGUAGE_MAP['US'];
}

function getTimezone(countryCode: string): string {
  const tz = TIMEZONE_MAP[countryCode] || 'UTC';
  if (Array.isArray(tz)) {
    return tz[Math.floor(cryptoRandom() * tz.length)];
  }
  return tz;
}

function validatePhonePrefix(phone: string, countryCode: string): boolean {
  const prefixes = PHONE_PREFIX_MAP[countryCode];
  if (!prefixes) return true; // Unknown country, skip validation
  
  const cleanPhone = phone.replace(/\s/g, '');
  return prefixes.some(prefix => cleanPhone.startsWith(prefix));
}

// Main traffic simulation function
function generateTrafficSimulation(
  countryCode: string,
  state: TrafficSimulationState,
  phone?: string
): { result: TrafficSimulationResult; updatedState: TrafficSimulationState } {
  // Validate phone prefix (log warning if mismatch)
  if (phone && !validatePhonePrefix(phone, countryCode)) {
    console.warn(`Phone prefix mismatch: ${phone} does not match country ${countryCode}`);
  }
  
  // 1. Select device type
  const { deviceType } = selectDeviceType(state);
  
  // 2. Select User-Agent (avoiding recent UAs)
  const userAgent = selectUserAgent(deviceType, state);
  
  // 3. Check for repeat IP (returning visitor)
  const repeatIP = checkRepeatIP(state);
  
  // 4. Select city and IP (or use repeat IP)
  let city: string;
  let ipAddress: string;
  let ipPrefix: string;
  
  if (repeatIP) {
    // Use repeat IP, find its city from history or use generic
    ipAddress = repeatIP;
    city = state.currentCity || 'Unknown';
    ipPrefix = repeatIP.split('.').slice(0, 2).join('.') + '.';
  } else {
    // Pass phone to selectCityAndIP for Canadian area code matching
    const cityResult = selectCityAndIP(countryCode, state, phone);
    city = cityResult.city;
    ipAddress = cityResult.ipAddress;
    ipPrefix = cityResult.ipPrefix;
  }
  
  // 5. Select ISP
  const ispName = selectISP(countryCode, state);
  
  // 6. Get language and timezone
  const browserLanguage = getLanguage(countryCode);
  const timezone = getTimezone(countryCode);
  
  // 7. Update state
  const updatedState: TrafficSimulationState = {
    lastDeviceTypes: [...(state.lastDeviceTypes || []).slice(-2), deviceType],
    lastUserAgents: [...(state.lastUserAgents || []).slice(-2), userAgent],
    currentCity: city,
    cityLeadsRemaining: repeatIP ? state.cityLeadsRemaining : (state.cityLeadsRemaining || 0) - 1,
    currentIsp: ispName,
    ispLeadsRemaining: (state.ispLeadsRemaining || 0) - 1,
    usedIps: [
      ...(state.usedIps || []).filter(entry => {
        // Keep only IPs from the last 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return new Date(entry.usedAt).getTime() > sevenDaysAgo;
      }),
      { ip: ipAddress, usedAt: new Date().toISOString() }
    ].slice(-100), // Keep max 100 IPs in history
  };
  
  const result: TrafficSimulationResult = {
    deviceType: deviceType.includes('android') || deviceType.includes('iphone') ? 'mobile' : 'desktop',
    userAgent,
    browserLanguage,
    timezone,
    city,
    ispName,
    ipAddress,
  };
  
  console.log(`Traffic simulation: device=${result.deviceType}, city=${city}, isp=${ispName}, ip=${ipAddress.substring(0, 10)}...`);
  
  return { result, updatedState };
}

// Legacy function for backward compatibility (used by adapters that don't support full simulation)
function generateGeoMatchedIP(countryCode: string): string {
  const cityPool = CITY_POOLS[countryCode] || CITY_POOLS['US'];
  const cityData = cityPool[Math.floor(Math.random() * cityPool.length)];
  const prefix = cityData.ipPrefixes[Math.floor(Math.random() * cityData.ipPrefixes.length)];
  const octet3 = Math.floor(Math.random() * 254) + 1;
  const octet4 = Math.floor(Math.random() * 254) + 1;
  return `${prefix}${octet3}.${octet4}`;
}

// Cryptographic-quality random number (0-1)
function cryptoRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xFFFFFFFF + 1);
}

// Generate multiple independent random values for mixing
function getRandomFactors(count: number): number[] {
  const array = new Uint32Array(count);
  crypto.getRandomValues(array);
  return Array.from(array).map(v => v / (0xFFFFFFFF + 1));
}

// Generate truly random delay with MAXIMUM unpredictability to prevent pattern detection
// CRITICAL: Every delay must have unique minutes AND seconds - no detectable patterns!
function generateRandomDelay(minDelay: number, maxDelay: number): number {
  const range = maxDelay - minDelay;
  if (range <= 0) return minDelay;
  
  // Get 7 independent crypto-random values for maximum entropy
  const [r1, r2, r3, r4, r5, r6, r7] = getRandomFactors(7);
  
  // Choose distribution algorithm randomly (prevents consistent patterns)
  const algorithmChoice = Math.floor(r1 * 5);
  
  let baseOffset: number;
  
  switch (algorithmChoice) {
    case 0:
      // Pure uniform distribution
      baseOffset = r2 * range;
      break;
    case 1:
      // Triangular distribution (tends toward center)
      baseOffset = ((r2 + r3) / 2) * range;
      break;
    case 2:
      // Beta-like distribution (can be skewed left or right)
      const skew = r3 > 0.5 ? 0.7 : 1.4;
      baseOffset = Math.pow(r2, skew) * range;
      break;
    case 3:
      // Bi-modal (favors extremes - short OR long delays)
      if (r3 > 0.5) {
        baseOffset = r2 * 0.3 * range; // Short delay zone
      } else {
        baseOffset = (0.7 + r2 * 0.3) * range; // Long delay zone
      }
      break;
    case 4:
    default:
      // Weighted random with variable weight
      const weight = 0.3 + r3 * 0.4; // Weight between 0.3-0.7
      baseOffset = (r2 * weight + r4 * (1 - weight)) * range;
      break;
  }
  
  // Add multi-layer jitter to break any remaining patterns
  // Layer 1: Percentage-based jitter (±15% of position in range)
  const jitter1 = (r4 - 0.5) * 0.15 * range;
  
  // Layer 2: Fixed micro-jitter (±3-8 seconds)
  const microJitterRange = 3 + r5 * 5;
  const jitter2 = (r5 - 0.5) * 2 * microJitterRange;
  
  // Layer 3: Occasional "burst" adjustment (10% chance of significant shift)
  let burstAdjust = 0;
  if (r6 < 0.05) {
    // 5% chance: much shorter delay (simulate burst)
    burstAdjust = -range * 0.2 * r3;
  } else if (r6 > 0.95) {
    // 5% chance: much longer delay (simulate pause)
    burstAdjust = range * 0.25 * r4;
  }
  
  // Combine all components to get raw delay
  const rawDelay = minDelay + baseOffset + jitter1 + jitter2 + burstAdjust;
  
  // Clamp to valid range
  let finalDelay = Math.max(minDelay, Math.min(maxDelay, rawDelay));
  
  // Add small jitter (±10 seconds) for timestamp variation WITHOUT breaking minDelay constraint
  // NOTE: Removed the sub-minute randomization that was overwriting the delay.
  // The previous code extracted minutes and added random 0-59 seconds, which could
  // result in delays below minDelay (e.g., min=30, got 28s gap between leads).
  const smallJitter = Math.floor((r7 - 0.5) * 20); // ±10 seconds
  finalDelay += smallJitter;
  
  // Final clamp to ensure we stay within bounds (as integer seconds)
  finalDelay = Math.max(minDelay, Math.min(maxDelay, finalDelay));
  
  console.log(`Random delay generated: ${Math.floor(finalDelay)}s (${Math.floor(finalDelay/60)}m ${Math.floor(finalDelay) % 60}s), algorithm=${algorithmChoice}`);
  
  return Math.floor(finalDelay);
}

// Calculate standard delay using min/max delay settings
function calculateStandardDelay(injection: Injection): number {
  const minDelay = injection.min_delay_seconds || 30;
  const maxDelay = injection.max_delay_seconds || 180;
  const noiseLevel = injection.noise_level || 'medium';
  
  // Noise level affects range expansion AND unpredictability
  const noiseConfig: Record<string, { multiplier: number; extraJitter: number }> = {
    low: { multiplier: 0.9, extraJitter: 0.05 },
    medium: { multiplier: 1.1, extraJitter: 0.12 },
    high: { multiplier: 1.4, extraJitter: 0.20 },
  };
  const config = noiseConfig[noiseLevel] || noiseConfig.medium;
  
  // Expand range based on noise level
  const center = (minDelay + maxDelay) / 2;
  const halfRange = (maxDelay - minDelay) / 2;
  const adjustedMin = Math.max(10, center - halfRange * config.multiplier);
  const adjustedMax = center + halfRange * config.multiplier;
  
  // Get base delay from the enhanced random generator (already has second-level randomization)
  let delay = generateRandomDelay(adjustedMin, adjustedMax);
  
  // Add noise-level-specific extra jitter (now in whole seconds, not fractions)
  const extraJitterSeconds = Math.floor((cryptoRandom() - 0.5) * 2 * config.extraJitter * (maxDelay - minDelay));
  delay += extraJitterSeconds;
  
  // Final clamp to ensure we stay within bounds (NO rounding - already integers)
  return Math.max(minDelay, Math.min(maxDelay, delay));
}

// ============ SUPER SMART RANDOMIZATION (Budget-Based Self-Balancing) ============
// This algorithm produces highly variable gaps that still average out to the required pacing.
// It guarantees completion within the working window by enforcing a "max allowable delay" constraint.

/**
 * Get remaining seconds until the end of the current working window (UTC).
 * For cross-midnight windows (e.g., 20:00 → 02:00), this is handled correctly.
 * For 24/7 mode (no working hours), returns seconds until end of UTC day.
 * 
 * @param injection - The injection configuration
 * @param fromTime - The base time to calculate from (scheduled time of previous lead)
 * @returns Remaining seconds in window, or 0 if outside window
 */
function getRemainingWindowSeconds(injection: Injection, fromTime: Date): number {
  const now = fromTime;
  
  // 24/7 mode: return seconds until end of UTC day
  if (!injection.working_start_time || !injection.working_end_time) {
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
  }

  const startParts = injection.working_start_time.split(':').map(Number);
  const endParts = injection.working_end_time.split(':').map(Number);
  const startH = startParts[0] ?? 0;
  const startM = startParts[1] ?? 0;
  const endH = endParts[0] ?? 0;
  const endM = endParts[1] ?? 0;

  const pad = (n: number) => String(n).padStart(2, '0');
  const currentTimeStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
  const startStr = `${pad(startH)}:${pad(startM)}:00`;
  const endStr = `${pad(endH)}:${pad(endM)}:00`;
  
  const crossesMidnight = startStr > endStr;

  // Check if we're within the window
  const isWithin = crossesMidnight
    ? (currentTimeStr >= startStr || currentTimeStr <= endStr)
    : (currentTimeStr >= startStr && currentTimeStr <= endStr);

  if (!isWithin) {
    return 0; // Outside window - caller should fall back to standard delay
  }

  // Calculate end time for today
  const endTime = new Date(now);
  endTime.setUTCHours(endH, endM, 0, 0);

  // Handle cross-midnight: if end is "earlier" than start, we're in a cross-midnight scenario
  if (crossesMidnight) {
    // If current time is after start (before midnight), end is tomorrow
    if (currentTimeStr >= startStr) {
      endTime.setUTCDate(endTime.getUTCDate() + 1);
    }
    // If current time is before end (after midnight), end is today - already correct
  }

  const remainingMs = endTime.getTime() - now.getTime();
  return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * Calculate "Super Smart" delay using budget-based self-balancing algorithm.
 * 
 * Key properties:
 * - Produces highly variable gaps (some short, some long)
 * - Averages out to the required pacing (timeLeft ÷ remainingLeads)
 * - Guarantees completion within window via max allowable constraint
 * - Respects min_delay_seconds and max_delay_seconds
 * 
 * @param injection - The injection configuration
 * @param remainingLeads - Number of leads still to send
 * @param remainingSeconds - Time left in current working window
 * @returns Delay in seconds
 */
function calculateSuperSmartDelay(injection: Injection, remainingLeads: number, remainingSeconds: number): number {
  // Use user's configured min/max as bounds, with sensible defaults
  const userMinDelay = injection.min_delay_seconds || 30;
  const userMaxDelay = injection.max_delay_seconds || 180;
  
  // Absolute limits to prevent extreme values
  const ABSOLUTE_MIN_FLOOR = 30;   // Never go below 30 seconds
  const ABSOLUTE_MAX_CAP = 3600;   // Never exceed 1 hour
  
  // Respect user settings but enforce absolute limits
  const effectiveMinDelay = Math.max(ABSOLUTE_MIN_FLOOR, userMinDelay);
  const effectiveMaxDelay = Math.min(ABSOLUTE_MAX_CAP, userMaxDelay);

  // Edge cases: fall back to user's min
  if (remainingSeconds <= 0 || remainingLeads <= 0) {
    return effectiveMinDelay;
  }

  // Calculate ideal average delay to spread leads evenly
  const idealAvg = Math.floor(remainingSeconds / remainingLeads);

  // Flexibility score: wide variation early, tight later
  // When many leads remain, we can be more flexible; when few remain, tighten up
  const flexibilityScore = Math.min(1.0, remainingLeads / 20); // Max flexibility at 20+ leads
  
  // Calculate multipliers based on flexibility
  // Early (high flexibility): 0.5x to 2.0x of ideal (within user bounds)
  // Late (low flexibility): 0.8x to 1.2x of ideal
  const minMultiplier = 0.5 + (1 - flexibilityScore) * 0.3; // 0.5 → 0.8
  const maxMultiplier = 2.0 - (1 - flexibilityScore) * 0.8; // 2.0 → 1.2

  // Calculate range bounds - use ideal but clamp to user's min/max
  let rangeMin = Math.max(effectiveMinDelay, Math.floor(idealAvg * minMultiplier));
  let rangeMax = Math.min(effectiveMaxDelay, Math.floor(idealAvg * maxMultiplier));

  // Safety: ensure rangeMax >= rangeMin
  if (rangeMax < rangeMin) {
    rangeMax = rangeMin;
  }

  // ========== WEIGHTED ZONE SELECTION ==========
  // Instead of uniform random, pick from weighted zones for human-like variation
  // Zone distribution: BURST (12%), NORMAL (28%), SLOW (35%), LULL (25%)
  const range = rangeMax - rangeMin;
  const zonePick = cryptoRandom();
  let delay: number;
  let zoneName: string;

  if (range <= 60) {
    // Narrow range - use uniform selection
    delay = rangeMin + Math.floor(cryptoRandom() * range);
    zoneName = 'NARROW';
  } else {
    // Wide range - use zone-based selection for natural variation
    const zoneBreaks = {
      burst: rangeMin + range * 0.15,      // Bottom 15% of range
      normal: rangeMin + range * 0.45,     // 15-45% of range
      slow: rangeMin + range * 0.75,       // 45-75% of range
      lull: rangeMax                        // 75-100% of range
    };

    if (zonePick < 0.12) {
      // 12% - BURST: quick send (rangeMin to burst boundary)
      delay = rangeMin + Math.floor(cryptoRandom() * (zoneBreaks.burst - rangeMin));
      zoneName = 'BURST';
    } else if (zonePick < 0.40) {
      // 28% - NORMAL: typical human pace (burst to normal boundary)
      delay = zoneBreaks.burst + Math.floor(cryptoRandom() * (zoneBreaks.normal - zoneBreaks.burst));
      zoneName = 'NORMAL';
    } else if (zonePick < 0.75) {
      // 35% - SLOW: natural pauses (normal to slow boundary)
      delay = zoneBreaks.normal + Math.floor(cryptoRandom() * (zoneBreaks.slow - zoneBreaks.normal));
      zoneName = 'SLOW';
    } else {
      // 25% - LULL: long gaps (slow to rangeMax)
      delay = zoneBreaks.slow + Math.floor(cryptoRandom() * (rangeMax - zoneBreaks.slow));
      zoneName = 'LULL';
    }
  }

  // Safety clamp to guarantee we can finish on time
  // maxAllowable = remaining time minus minimum time needed for all other leads
  const maxAllowable = remainingSeconds - (remainingLeads - 1) * effectiveMinDelay;
  delay = Math.min(delay, Math.max(effectiveMinDelay, maxAllowable));

  // Smaller jitter (±15s instead of ±30s) to preserve zone selection
  const jitter = Math.floor((cryptoRandom() - 0.5) * 30);
  delay += jitter;

  // NOTE: Removed sub-minute randomization that was overwriting the delay
  // The previous code extracted minutes and added random 0-59 seconds,
  // which could result in two consecutive leads getting timestamps only
  // 1-2 seconds apart (breaking the 30s floor). The jitter above provides
  // enough variation without violating the minimum delay constraint.

  // Final clamp to respect user's configured bounds
  delay = Math.max(effectiveMinDelay, Math.min(effectiveMaxDelay, delay));

  console.log(`SuperSmart delay: budget=${remainingSeconds}s, leads=${remainingLeads}, ideal=${idealAvg}s, flex=${flexibilityScore.toFixed(2)}, zone=${zoneName}, range=[${rangeMin}s-${rangeMax}s], userBounds=[${userMinDelay}s-${userMaxDelay}s], chosen=${delay}s (${Math.floor(delay/60)}m ${delay%60}s)`);

  return Math.floor(delay);
}

/**
 * Calculate smart delay using the new budget-based approach.
 * Falls back to standard delay if outside working window or in 24/7 mode without usable budget.
 * 
 * @param injection - The injection configuration
 * @param remainingLeads - Number of leads still to send
 * @param fromTime - The base time to calculate from (for proper staggered scheduling)
 * @returns Delay in seconds
 */
function calculateSmartDelay(injection: Injection, remainingLeads: number, fromTime: Date): number {
  // If smart mode is disabled or no remaining leads, use standard logic
  if (remainingLeads <= 0) {
    return calculateStandardDelay(injection);
  }

  // Get remaining seconds in the current working window
  const remainingSeconds = getRemainingWindowSeconds(injection, fromTime);

  // If no usable budget (outside window or too little time), fall back to standard
  if (remainingSeconds <= 0) {
    console.log(`Smart delay: outside window or no budget, falling back to standard delay`);
    return calculateStandardDelay(injection);
  }

  // Use the super smart budget-based algorithm
  return calculateSuperSmartDelay(injection, remainingLeads, remainingSeconds);
}

// deno-lint-ignore no-explicit-any
async function getRemainingLeadsCount(supabase: any, injectionId: string): Promise<number> {
  const { count } = await supabase
    .from('injection_leads')
    .select('id', { count: 'exact', head: true })
    .eq('injection_id', injectionId)
    .in('status', ['pending', 'scheduled']);
  
  return count || 0;
}

/**
 * Get the number of sendable leads considering GEO cap constraints.
 * This is critical for smart mode delay calculation - we need to spread
 * only the SENDABLE leads across the time window, not all pending leads.
 * 
 * Example: If we have 400 pending leads but only 20 cap remaining for CA,
 * we should space those 20 leads across 9 hours = ~27 min per lead,
 * NOT 400 leads across 9 hours = ~1 min per lead.
 */
// deno-lint-ignore no-explicit-any
async function getSendableLeadsCount(supabase: any, injection: Injection): Promise<number> {
  const geoCaps = injection.geo_caps || {};
  const geoBaseline = injection.geo_caps_baseline || {};
  
  // If no GEO caps are set, return total remaining leads
  if (Object.keys(geoCaps).length === 0) {
    return await getRemainingLeadsCount(supabase, injection.id);
  }
  
  // Get sent counts per country for this injection
  const { data: sentCounts } = await supabase
    .from('injection_leads')
    .select('country_code')
    .eq('injection_id', injection.id)
    .eq('status', 'sent');
  
  const sentByCountry: Record<string, number> = {};
  if (sentCounts) {
    for (const lead of sentCounts) {
      const cc = lead.country_code || 'UNKNOWN';
      sentByCountry[cc] = (sentByCountry[cc] || 0) + 1;
    }
  }
  
  // Get pending leads per country
  const { data: pendingLeads } = await supabase
    .from('injection_leads')
    .select('country_code')
    .eq('injection_id', injection.id)
    .in('status', ['pending', 'scheduled']);
  
  const pendingByCountry: Record<string, number> = {};
  if (pendingLeads) {
    for (const lead of pendingLeads) {
      const cc = lead.country_code || 'UNKNOWN';
      pendingByCountry[cc] = (pendingByCountry[cc] || 0) + 1;
    }
  }
  
  // Calculate sendable leads per country (min of pending and remaining cap)
  let totalSendable = 0;
  
  for (const [countryCode, pending] of Object.entries(pendingByCountry)) {
    const cap = geoCaps[countryCode];
    
    if (cap === undefined) {
      // No cap for this country - lead will be skipped, don't count
      continue;
    }
    
    // Calculate effective sent (excluding baseline from resume)
    const baseline = geoBaseline[countryCode] || 0;
    const sent = sentByCountry[countryCode] || 0;
    const effectiveSent = Math.max(0, sent - baseline);
    
    // Remaining cap capacity
    const remainingCap = Math.max(0, cap - effectiveSent);
    
    // Sendable = min of pending and remaining cap
    const sendable = Math.min(pending, remainingCap);
    totalSendable += sendable;
  }
  
  console.log(`Sendable leads calculation: total=${totalSendable}, sentByCountry=${JSON.stringify(sentByCountry)}, caps=${JSON.stringify(geoCaps)}, baseline=${JSON.stringify(geoBaseline)}`);
  
  return totalSendable;
}

// Calculate next send time based on a given base time (for proper staggering)
// deno-lint-ignore no-explicit-any
async function calculateNextSendTimeAsync(supabase: any, injection: Injection, baseTime?: Date): Promise<Date> {
  // Use provided base time or current time - CRITICAL for proper budget calculation
  const fromTime = baseTime || new Date();
  let delay: number;
  
  if (injection.smart_mode) {
    // CRITICAL: Use sendable leads (considering GEO caps) NOT total remaining leads!
    // This ensures proper pacing: 20 capped leads over 9 hours = ~27min per lead
    // vs. 400 total leads over 9 hours = ~1min per lead (WRONG!)
    const sendableLeads = await getSendableLeadsCount(supabase, injection);
    // Pass fromTime so the budget-based algorithm calculates correctly for chained scheduling
    delay = calculateSmartDelay(injection, sendableLeads, fromTime);
    console.log(`Smart mode: ${sendableLeads} sendable leads (cap-aware), delay: ${delay}s`);
  } else {
    delay = calculateStandardDelay(injection);
  }
  
  const scheduledTime = new Date(fromTime.getTime() + delay * 1000);
  
  // Add random milliseconds (0-999) for sub-second uniqueness
  // This ensures even if two delays calculate to the same second, timestamps differ
  const msJitter = Math.floor(cryptoRandom() * 1000);
  scheduledTime.setMilliseconds(msJitter);
  
  // IMPORTANT: Only apply working hours/days restrictions if BOTH are configured
  // If no working hours are set, injection runs 24/7 regardless of working_days
  const hasWorkingHours = injection.working_start_time && injection.working_end_time;
  
  if (hasWorkingHours) {
    const workingStart = injection.working_start_time!;
    const workingEnd = injection.working_end_time!;
    
    const hours = scheduledTime.getUTCHours();
    const minutes = scheduledTime.getUTCMinutes();
    // Compare as HH:MM:SS strings to match DB time format (avoid lexicographic bugs)
    const seconds = scheduledTime.getUTCSeconds();
    const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (currentTime < workingStart || currentTime > workingEnd) {
      // Move to start of next working window
      const [startHour, startMin] = workingStart.split(':').map(Number);
      scheduledTime.setUTCHours(startHour, startMin, 0, 0);
      
      // If we moved backwards, go to next day
      if (scheduledTime.getTime() <= fromTime.getTime()) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
    }
    
    // Only check working days when working hours are configured
    if (injection.working_days && injection.working_days.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      let currentDay = scheduledTime.getUTCDay();
      let attempts = 0;
      
      while (!injection.working_days.includes(dayNames[currentDay]) && attempts < 7) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
        // When moving to a new day, set time to start of working hours
        const [startHour, startMin] = workingStart.split(':').map(Number);
        scheduledTime.setUTCHours(startHour, startMin, 0, 0);
        currentDay = scheduledTime.getUTCDay();
        attempts++;
      }
    }
  }
  
  return scheduledTime;
}

// Synchronous version for reschedule action (uses standard delay)
function calculateNextSendTime(injection: Injection, baseTime?: Date): Date {
  const delay = calculateStandardDelay(injection);
  const fromTime = baseTime || new Date();
  const scheduledTime = new Date(fromTime.getTime() + delay * 1000);
  
  // Add random milliseconds (0-999) for sub-second uniqueness
  const msJitter = Math.floor(cryptoRandom() * 1000);
  scheduledTime.setMilliseconds(msJitter);
  
  // IMPORTANT: Only apply working hours/days restrictions if BOTH are configured
  // If no working hours are set, injection runs 24/7 regardless of working_days
  const hasWorkingHours = injection.working_start_time && injection.working_end_time;
  
  if (hasWorkingHours) {
    const workingStart = injection.working_start_time!;
    const workingEnd = injection.working_end_time!;
    
    const hours = scheduledTime.getUTCHours();
    const minutes = scheduledTime.getUTCMinutes();
    const seconds = scheduledTime.getUTCSeconds();
    const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (currentTime < workingStart || currentTime > workingEnd) {
      const [startHour, startMin] = workingStart.split(':').map(Number);
      scheduledTime.setUTCHours(startHour, startMin, 0, 0);
      
      if (scheduledTime.getTime() <= fromTime.getTime()) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
    }
    
    // Only check working days when working hours are configured
    if (injection.working_days && injection.working_days.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      let currentDay = scheduledTime.getUTCDay();
      let attempts = 0;
      
      while (!injection.working_days.includes(dayNames[currentDay]) && attempts < 7) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
        const [startHour, startMin] = workingStart.split(':').map(Number);
        scheduledTime.setUTCHours(startHour, startMin, 0, 0);
        currentDay = scheduledTime.getUTCDay();
        attempts++;
      }
    }
  }
  
  return scheduledTime;
}

// Helper to extract external lead ID from response
function extractExternalLeadId(responseText: string): string | null {
  try {
    const data = JSON.parse(responseText);
    if (data.details?.leadRequest?.ID) return String(data.details.leadRequest.ID);
    return String(data.lead_id || data.leadId || data.id || data.signupId || data.signupID ||
           data.data?.lead_id || data.data?.leadId || data.data?.id || 
           data.data?.signupId || data.data?.signupID || data.leadRequestID || '');
  } catch {
    const uuidMatch = responseText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) return uuidMatch[0];
    const numMatch = responseText.match(/"(?:lead_?id|id)":\s*(\d+)/i);
    if (numMatch) return numMatch[1];
    return null;
  }
}

// Helper to extract autologin URL from response
function extractAutologinUrl(responseText: string): string | null {
  try {
    const data = JSON.parse(responseText);
    if (data.details?.redirect?.url) return String(data.details.redirect.url);
    const url = data.autologin_url || data.autologinUrl || data.autoLoginUrl ||
                data.redirect_url || data.redirectUrl || data.login_url || data.loginUrl ||
                data.data?.autologin_url || data.data?.autologinUrl || data.data?.autoLoginUrl ||
                data.data?.redirect_url || data.data?.redirectUrl || data.data?.login_url || 
                data.data?.loginUrl || data.url || data.data?.url || null;
    
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
    return null;
  } catch {
    const urlMatch = responseText.match(/"(?:autologin_?url|redirect_?url|login_?url|url)":\s*"(https?:\/\/[^"]+)"/i);
    if (urlMatch) return urlMatch[1];
    return null;
  }
}

// Advertiser adapters
const advertiserAdapters: Record<string, (lead: InjectionLead, advertiser: Advertiser) => Promise<{ success: boolean; response: string }>> = {
  
  enigma: async (lead, advertiser) => {
    const generatePassword = () => {
      const lower = 'abcdefghijklmnopqrstuvwxyz';
      const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const digits = '0123456789';
      const all = lower + upper + digits;
      let password = upper.charAt(Math.floor(Math.random() * upper.length));
      password += lower.charAt(Math.floor(Math.random() * lower.length));
      password += digits.charAt(Math.floor(Math.random() * digits.length));
      for (let i = 0; i < 7; i++) {
        password += all.charAt(Math.floor(Math.random() * all.length));
      }
      return password;
    };

    const phoneDigits = (lead.mobile || '').replace(/\D/g, '');
    let localDigits = phoneDigits;
    if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
      localDigits = phoneDigits.slice(1);
    } else if (phoneDigits.length > 11) {
      localDigits = phoneDigits.slice(-10);
    }

    const params = new URLSearchParams();
    params.append('email', lead.email);
    params.append('firstName', lead.firstname);
    params.append('lastName', lead.lastname);
    params.append('password', generatePassword());
    params.append('ip', lead.ip_address || generateGeoMatchedIP(lead.country_code));
    params.append('phone', localDigits);
    // Determine offerWebsite/Referer
    // Priority: config.offer_website (advertiser-level) > lead offer_name if it's a URL > lead offer_name as-is
    const config = advertiser.config || {};
    let offerWebsite = '';
    const leadOfferName = lead.offer_name || '';
    if (config.offer_website) {
      // Advertiser has a configured offer website - use it for Referer
      offerWebsite = String(config.offer_website);
      if (!offerWebsite.startsWith('http') && offerWebsite.includes('.')) {
        offerWebsite = `https://${offerWebsite}`;
      }
    } else if (leadOfferName.includes('.') && (leadOfferName.startsWith('http') || leadOfferName.startsWith('www'))) {
      offerWebsite = leadOfferName.startsWith('http') ? leadOfferName : `https://${leadOfferName}`;
    } else if (leadOfferName) {
      offerWebsite = leadOfferName;
    }

    if (lead.offer_name) params.append('offerName', lead.offer_name);
    if (offerWebsite) params.append('offerWebsite', offerWebsite);
    if (lead.custom1) params.append('custom1', lead.custom1);
    if (lead.custom2) params.append('custom2', lead.custom2);
    if (lead.custom3) params.append('custom3', lead.custom3);
    if (lead.comment) params.append('comment', lead.comment);

    const clientIp = lead.ip_address || generateGeoMatchedIP(lead.country_code);
    console.log('Enigma injection payload:', params.toString());
    console.log('Enigma client IP for forwarding:', clientIp);
    console.log('Enigma offer_website:', offerWebsite);

    const skipForwardedFor = config.skip_forwarded_for === true;
    const fwdHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Target-Url': advertiser.url,
        'X-Api-Key': advertiser.api_key,
        // Traffic simulation headers
        'X-Forwarded-User-Agent': lead.user_agent || '',
        'X-Forwarded-Accept-Language': lead.browser_language || '',
        'X-Forwarded-Timezone': lead.timezone || '',
      };
    // Only forward client IP if not disabled (some APIs use X-Forwarded-For for IP whitelisting)
    if (!skipForwardedFor) {
      fwdHeaders['X-Forwarded-For'] = clientIp;
    }
    if (offerWebsite) {
      fwdHeaders['X-Custom-Referer'] = offerWebsite;
      fwdHeaders['Referer'] = offerWebsite;
      fwdHeaders['X-Forwarded-Referer'] = offerWebsite;
    }
    console.log('Enigma forwarding headers:', JSON.stringify(fwdHeaders));

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: fwdHeaders,
      body: params.toString(),
    });

    const text = await response.text();
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      if (json.code !== undefined && json.code !== 0) isSuccess = false;
      if (json.success === false || json.error) isSuccess = false;
    } catch {
      if (text.toLowerCase().includes('error')) isSuccess = false;
    }
    
    return { success: isSuccess, response: text };
  },

  elitecrm: async (lead, advertiser) => {
    const config = advertiser.config || {};
    const payload: Record<string, string> = {
      sender: String(config.sender || ''),
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      mobile: lead.mobile,
      country_code: lead.country_code,
      ip_address: lead.ip_address || generateGeoMatchedIP(lead.country_code),
      country: lead.country || '',
    };

    if (lead.offer_name) payload.offerName = lead.offer_name;
    if (lead.custom1) payload.custom1 = lead.custom1;
    if (lead.custom2) payload.custom2 = lead.custom2;
    if (lead.custom3) payload.custom3 = lead.custom3;
    if (lead.comment) payload.comment = lead.comment;

    console.log('EliteCRM injection payload:', JSON.stringify(payload));

    // Retry logic for server errors (500s)
    const maxRetries = 3;
    let lastResponse = '';
    let lastSuccess = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add 15-second timeout per request to prevent edge function timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Api-Key': advertiser.api_key,
          };
        if (lead.offer_name) headers['Referer'] = lead.offer_name;

        const response = await fetch(advertiser.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        const text = await response.text();
        lastResponse = text;
        
        // If server error (500), retry after delay
        if (response.status >= 500 && attempt < maxRetries) {
          console.log(`EliteCRM server error (attempt ${attempt}/${maxRetries}), retrying in ${attempt * 2}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        
        lastSuccess = response.ok;
        try {
          const json = JSON.parse(text);
          if (json.success === false || json.error) lastSuccess = false;
        } catch {
          if (text.toLowerCase().includes('error')) lastSuccess = false;
        }
        
        // If successful or non-retryable error, break
        if (lastSuccess || response.status < 500) {
          break;
        }
      } catch (err) {
        const errMsg = err instanceof Error && err.name === 'AbortError' 
          ? 'Request timeout (15s)' 
          : String(err);
        console.error(`EliteCRM fetch error (attempt ${attempt}/${maxRetries}):`, errMsg);
        lastResponse = errMsg;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }
    
    return { success: lastSuccess, response: lastResponse };
  },

  timelocal: async (lead, advertiser) => {
    const payload = {
      first_name: lead.firstname,
      last_name: lead.lastname,
      email: lead.email,
      phone_number: lead.mobile,
      country_code: lead.country_code,
      ip_address: lead.ip_address || generateGeoMatchedIP(lead.country_code),
      campaign: lead.offer_name || '',
      sub_id: lead.custom1 || '',
    };

    console.log('Timelocal injection payload:', JSON.stringify(payload));

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-Url': advertiser.url,
        'X-Api-Key': advertiser.api_key,
        'X-Content-Type': 'application/json',
        // Traffic simulation headers
        'X-Forwarded-User-Agent': lead.user_agent || '',
        'X-Forwarded-Accept-Language': lead.browser_language || '',
        'X-Forwarded-Timezone': lead.timezone || '',
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
      userip: lead.ip_address || generateGeoMatchedIP(lead.country_code),
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

    console.log('TrackBox injection payload:', JSON.stringify(payload));

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-Url': advertiser.url,
        'X-Api-Key': apiKeyPost,
        'X-Content-Type': 'application/json',
        'X-Trackbox-Username': String(config.username || ''),
        'X-Trackbox-Password': String(config.password || ''),
        // Traffic simulation headers
        'X-Forwarded-User-Agent': lead.user_agent || '',
        'X-Forwarded-Accept-Language': lead.browser_language || '',
        'X-Forwarded-Timezone': lead.timezone || '',
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
    params.append('ip', lead.ip_address || generateGeoMatchedIP(lead.country_code));
    if (lead.custom1) params.append('suid', lead.custom1);
    if (lead.custom2) params.append('clickid', lead.custom2);
    if (lead.offer_name) params.append('desc', lead.offer_name);

    const apiUrl = advertiser.url || 'https://tracker.doctor-mailer.com/repost.php?act=register';

    console.log('DrMailer injection payload:', params.toString());

    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Target-Url': apiUrl,
        'X-Content-Type': 'application/x-www-form-urlencoded',
        // Traffic simulation headers
        'X-Forwarded-User-Agent': lead.user_agent || '',
        'X-Forwarded-Accept-Language': lead.browser_language || '',
        'X-Forwarded-Timezone': lead.timezone || '',
      },
      body: params.toString(),
    });

    const text = await response.text();
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      if (json.status === 'error' || json.error) isSuccess = false;
    } catch {
      if (text.toLowerCase().includes('error')) isSuccess = false;
    }
    
    return { success: isSuccess, response: text };
  },

  // GSI Markets API format (PHP-based with id/hash in form body)
  // GSI expects: act, id, hash as form params, NOT URL query params
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
    params.append('ip', lead.ip_address || generateGeoMatchedIP(lead.country_code));
    
    // Optional fields
    if (lead.offer_name) params.append('campaign', lead.offer_name);
    if (lead.custom1) params.append('custom1', lead.custom1);
    if (lead.custom2) params.append('custom2', lead.custom2);
    if (lead.custom3) params.append('custom3', lead.custom3);
    if (lead.comment) params.append('comment', lead.comment);

    const targetUrl = advertiser.url || 'https://www.gsimarkets.com/api_add2.php';
    
    console.log('GSI injection payload:', params.toString());
    console.log('GSI target URL:', targetUrl);
    console.log('GSI routing through VPS forwarder:', FORWARDER_URL);

    // Route through VPS forwarder for static IP whitelisting
    const response = await fetch(FORWARDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Target-Url': targetUrl,
        'X-Api-Key': '', // Required by forwarder even if empty
        // Traffic simulation headers
        'X-Forwarded-User-Agent': lead.user_agent || '',
        'X-Forwarded-Accept-Language': lead.browser_language || '',
        'X-Forwarded-Timezone': lead.timezone || '',
      },
      body: params.toString(),
    });

    const text = await response.text();
    console.log('GSI forwarder status:', response.status);
    console.log('GSI response:', text);
    let isSuccess = response.ok;
    try {
      const json = JSON.parse(text);
      if (json.status === 'error' || json.error || json.success === false) {
        isSuccess = false;
      }
      if (json.code !== undefined && json.code !== 0 && json.code !== '0') {
        isSuccess = false;
      }
    } catch {
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('invalid')) {
        isSuccess = false;
      }
    }
    
    return { success: isSuccess, response: text };
  },
};

// Global Send Protection System - Atomic locking with protection rules
interface SendCheckResult {
  allowed: boolean;
  reason?: string;
}

// deno-lint-ignore no-explicit-any
async function canSendLead(
  supabase: any,
  email: string,
  advertiserId: string,
  injectionId: string,
  countryCode: string
): Promise<SendCheckResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // RULE 1: Check 24-hour multi-advertiser protection
  // Lead cannot be sent to more than 1 advertiser within 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentSendsToOthers } = await supabase
    .from('global_sent_leads')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalizedEmail)
    .neq('advertiser_id', advertiserId)
    .gt('sent_at', oneDayAgo);

  if ((recentSendsToOthers || 0) > 0) {
    console.log(`Lead ${email}: Blocked by 24-hour multi-advertiser rule - already sent to another advertiser`);
    return { allowed: false, reason: 'Sent to another advertiser within 24 hours' };
  }

  // RULE 2: Check 5-day cooldown for same advertiser
  // Lead cannot be resent to the same advertiser for 5 days
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentSendsToSame } = await supabase
    .from('global_sent_leads')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalizedEmail)
    .eq('advertiser_id', advertiserId)
    .gt('sent_at', fiveDaysAgo);

  if ((recentSendsToSame || 0) > 0) {
    console.log(`Lead ${email}: Blocked by 5-day cooldown rule - already sent to this advertiser within 5 days`);
    return { allowed: false, reason: 'Sent to this advertiser within 5 days' };
  }

  // RULE 3: Check cross-system protection (live traffic from lead_distributions)
  const { data: matchingLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('email', normalizedEmail);

  const leadIds = matchingLeads?.map((l: { id: string }) => l.id) || [];

  if (leadIds.length > 0) {
    const { count: distributionCount } = await supabase
      .from('lead_distributions')
      .select('id', { count: 'exact', head: true })
      .eq('advertiser_id', advertiserId)
      .in('status', ['sent', 'failed'])
      .in('lead_id', leadIds);

    if ((distributionCount || 0) > 0) {
      console.log(`Lead ${email}: Blocked by cross-system protection - already sent via live distribution`);
      return { allowed: false, reason: 'Already sent via distribution system' };
    }
  }

  // RULE 4: Atomic lock - try to claim the lead NOW
  // Insert into global_sent_leads with ON CONFLICT to create atomic lock
  const { error: insertError } = await supabase
    .from('global_sent_leads')
    .insert({
      email: normalizedEmail,
      advertiser_id: advertiserId,
      injection_id: injectionId,
      country_code: countryCode,
      sent_at: new Date().toISOString(),
    });

  if (insertError?.code === '23505') {
    // Unique constraint violation - another worker already claimed this lead
    console.log(`Lead ${email}: Another injection claimed this lead (unique constraint violation)`);
    return { allowed: false, reason: 'Another injection claimed this lead' };
  }

  if (insertError) {
    console.error(`Lead ${email}: Error during atomic lock:`, insertError);
    return { allowed: false, reason: `Lock error: ${insertError.message}` };
  }

  return { allowed: true };
}

// deno-lint-ignore no-explicit-any
async function processNextLead(supabase: any, injection: Injection, advertiser: Advertiser): Promise<boolean> {
  // SIMPLIFIED FLOW: Immediately grab and send the next pending lead (no pre-scheduling)
  // Get next pending lead (ordered by creation, no time checks needed)
  const { data: eligibleLeads } = await supabase
    .from('injection_leads')
    .select('id')
    .eq('injection_id', injection.id)
    .in('status', ['pending', 'scheduled'])
    .order('created_at', { ascending: true })
    .limit(1);

  if (!eligibleLeads?.length) {
    console.log('No leads ready to process');
    return false;
  }

  const leadId = eligibleLeads[0].id;

  // Atomically claim the lead - only update if status is still pending/scheduled
  // This prevents race conditions when multiple workers try to process the same lead
  const { data: claimedLeads, error: claimError } = await supabase
    .from('injection_leads')
    .update({ 
      status: 'sending',
      scheduled_at: new Date().toISOString()
    })
    .eq('id', leadId)
    .in('status', ['pending', 'scheduled'])
    .select('*');

  if (claimError || !claimedLeads?.length) {
    console.log(`Lead ${leadId} already claimed by another worker`);
    return false;
  }

  const lead: InjectionLead = claimedLeads[0];
  console.log(`Processing injection lead: ${lead.email}`);

  // Check global send protection rules and try to claim the lead atomically
  const sendCheck = await canSendLead(supabase, lead.email, advertiser.id, injection.id, lead.country_code);
  if (!sendCheck.allowed) {
    console.log(`Skipping lead ${lead.email}: ${sendCheck.reason}`);
    await supabase
      .from('injection_leads')
      .update({ 
        status: 'skipped', 
        error_message: sendCheck.reason 
      })
      .eq('id', lead.id);
    
    await supabase
      .from('injections')
      .update({ skipped_count: injection.skipped_count + 1 })
      .eq('id', injection.id);
    
    return true;
  }

  // Check GEO cap if applicable
  if (injection.geo_caps && injection.geo_caps[lead.country_code] !== undefined) {
    const { count } = await supabase
      .from('injection_leads')
      .select('id', { count: 'exact', head: true })
      .eq('injection_id', injection.id)
      .eq('country_code', lead.country_code)
      .eq('status', 'sent');

    const totalSent = count || 0;
    // Subtract baseline (sent before resume) to evaluate caps fresh after resume
    const baseline = injection.geo_caps_baseline?.[lead.country_code] || 0;
    const effectiveSent = totalSent - baseline;
    
    console.log(`GEO cap check for ${lead.country_code}: sent=${totalSent}, baseline=${baseline}, effective=${effectiveSent}, cap=${injection.geo_caps[lead.country_code]}`);

    if (effectiveSent >= injection.geo_caps[lead.country_code]) {
      console.log(`GEO cap reached for ${lead.country_code}`);
      await supabase
        .from('injection_leads')
        .update({ status: 'skipped', error_message: `GEO cap reached for ${lead.country_code}` })
        .eq('id', lead.id);
      
      await supabase
        .from('injections')
        .update({ skipped_count: injection.skipped_count + 1 })
        .eq('id', injection.id);
      
      return true;
    }
  }

  // ============ TRAFFIC SIMULATION ============
  // Generate human-like traffic patterns (device, UA, IP clustering, ISP rotation, etc.)
  const currentState: TrafficSimulationState = injection.traffic_simulation_state || {
    lastDeviceTypes: [],
    lastUserAgents: [],
    currentCity: null,
    cityLeadsRemaining: 0,
    currentIsp: null,
    ispLeadsRemaining: 0,
    usedIps: [],
  };
  
  const { result: trafficSim, updatedState: newSimState } = generateTrafficSimulation(
    lead.country_code,
    currentState,
    lead.mobile
  );
  
  // Apply traffic simulation to lead (override IP if not manually set)
  const simulatedLead: InjectionLead = {
    ...lead,
    ip_address: lead.ip_address || trafficSim.ipAddress,
    device_type: trafficSim.deviceType,
    user_agent: trafficSim.userAgent,
    browser_language: trafficSim.browserLanguage,
    timezone: trafficSim.timezone,
    city: trafficSim.city,
    isp_name: trafficSim.ispName,
    offer_name: injection.offer_name || lead.offer_name,
  };
  
  // Update injection's traffic simulation state for next lead
  await supabase
    .from('injections')
    .update({ traffic_simulation_state: newSimState })
    .eq('id', injection.id);

  // Update lead with traffic simulation data (for record-keeping)
  await supabase
    .from('injection_leads')
    .update({
      ip_address: simulatedLead.ip_address,
      device_type: simulatedLead.device_type,
      user_agent: simulatedLead.user_agent,
      browser_language: simulatedLead.browser_language,
      timezone: simulatedLead.timezone,
      city: simulatedLead.city,
      isp_name: simulatedLead.isp_name,
    })
    .eq('id', lead.id);

  const effectiveLead = simulatedLead;

  // Send to advertiser
  const adapter = advertiserAdapters[advertiser.advertiser_type];
  if (!adapter) {
    console.error(`No adapter for advertiser type: ${advertiser.advertiser_type}`);
    await supabase
      .from('injection_leads')
      .update({ status: 'failed', error_message: `Unknown advertiser type: ${advertiser.advertiser_type}` })
      .eq('id', lead.id);
    
    await supabase
      .from('injections')
      .update({ failed_count: injection.failed_count + 1 })
      .eq('id', injection.id);
    
    return true;
  }

  try {
    const result = await adapter(effectiveLead, advertiser);
    console.log(`Injection result for ${lead.email}:`, result.success);

    const externalLeadId = extractExternalLeadId(result.response);
    const autologinUrl = extractAutologinUrl(result.response);

    if (result.success) {
      await supabase
        .from('injection_leads')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          response: result.response,
          external_lead_id: externalLeadId,
          autologin_url: autologinUrl,
          advertiser_id: advertiser.id,
        })
        .eq('id', lead.id);

      await supabase
        .from('injections')
        .update({ sent_count: injection.sent_count + 1 })
        .eq('id', injection.id);
    } else {
      // IMPORTANT: always store advertiser_id on failures too so the UI can show who rejected it
      await supabase
        .from('injection_leads')
        .update({
          status: 'failed',
          sent_at: new Date().toISOString(),
          response: result.response,
          advertiser_id: advertiser.id,
          error_message: result.response.substring(0, 500),
        })
        .eq('id', lead.id);

      await supabase
        .from('injections')
        .update({ failed_count: injection.failed_count + 1 })
        .eq('id', injection.id);
    }
  } catch (err) {
    console.error('Injection error:', err);
    await supabase
      .from('injection_leads')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      })
      .eq('id', lead.id);

    await supabase
      .from('injections')
      .update({ failed_count: injection.failed_count + 1 })
      .eq('id', injection.id);
  }

  return true;
}

// Keep UI in sync by marking the next lead as "scheduled" with a future scheduled_at.
// The actual sending is still controlled by injections.next_scheduled_at.
// deno-lint-ignore no-explicit-any
async function markNextLeadAsScheduled(
  supabase: any,
  injectionId: string,
  scheduledAt: Date,
  advertiserId: string
): Promise<void> {
  // Ensure we only ever show one upcoming scheduled lead for this injection
  await supabase
    .from('injection_leads')
    .update({ status: 'pending', scheduled_at: null, advertiser_id: null })
    .eq('injection_id', injectionId)
    .eq('status', 'scheduled');

  // Pick the next lead the processor would send (oldest pending)
  const { data: nextLeads } = await supabase
    .from('injection_leads')
    .select('id')
    .eq('injection_id', injectionId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  const nextLeadId = nextLeads?.[0]?.id;
  if (!nextLeadId) return;

  await supabase
    .from('injection_leads')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt.toISOString(),
      advertiser_id: advertiserId,
    })
    .eq('id', nextLeadId)
    .eq('status', 'pending');
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
      return new Response(JSON.stringify({ status: "ok", function: "send-injection" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { injection_id, action } = body;

    if (injection_id && action === 'pause') {
      // Pause injection and clear all schedules (service role, bypasses RLS)
      const { error: pauseError } = await supabase
        .from('injections')
        .update({ status: 'paused', next_scheduled_at: null })
        .eq('id', injection_id);

      if (pauseError) {
        return new Response(JSON.stringify({ error: pauseError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Reset any queued leads back to pending and remove scheduled times
      // (scheduled/sending/pending leads may still have scheduled_at)
      const { error: resetError } = await supabase
        .from('injection_leads')
        .update({ status: 'pending', scheduled_at: null })
        .eq('injection_id', injection_id)
        .in('status', ['pending', 'scheduled', 'sending']);

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Injection paused and schedule cleared' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (injection_id && action === 'clear-schedule') {
      // This action is deprecated - pause automatically clears schedule
      return new Response(JSON.stringify({ success: true, message: 'Use pause instead' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (injection_id && action === 'reschedule') {
      // Reschedule all pending/scheduled leads when settings change
      const { data: injection, error: injectionError } = await supabase
        .from('injections')
        .select('*')
        .eq('id', injection_id)
        .single();

      if (injectionError || !injection) {
        return new Response(JSON.stringify({ error: 'Injection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all scheduled leads (not pending, not sent/failed/skipped)
      const { data: scheduledLeads } = await supabase
        .from('injection_leads')
        .select('id')
        .eq('injection_id', injection_id)
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true });

      if (scheduledLeads?.length) {
        let scheduleTime = new Date();
        for (const lead of scheduledLeads) {
          // Use async version to respect smart_mode
          scheduleTime = await calculateNextSendTimeAsync(supabase, injection, scheduleTime);
          await supabase
            .from('injection_leads')
            .update({ scheduled_at: scheduleTime.toISOString() })
            .eq('id', lead.id);
        }

        // Update injection next_scheduled_at
        const { data: firstScheduled } = await supabase
          .from('injection_leads')
          .select('scheduled_at')
          .eq('injection_id', injection_id)
          .eq('status', 'scheduled')
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .single();

        if (firstScheduled?.scheduled_at) {
          await supabase
            .from('injections')
            .update({ next_scheduled_at: firstScheduled.scheduled_at })
            .eq('id', injection_id);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Rescheduled ${scheduledLeads?.length || 0} leads` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (injection_id && action === 'resume') {
      // Resume a completed injection - used when user adds more leads or increases caps
      const { data: injection, error: injectionError } = await supabase
        .from('injections')
        .select('*')
        .eq('id', injection_id)
        .single();

      if (injectionError || !injection) {
        return new Response(JSON.stringify({ error: 'Injection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only allow resuming completed or paused injections
      if (!['completed', 'paused'].includes(injection.status)) {
        return new Response(JSON.stringify({ error: `Cannot resume injection with status: ${injection.status}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== SAVE BASELINE: Current sent counts per country ==========
      // This allows new caps to be evaluated fresh (not counting previously sent leads)
      const { data: sentLeads } = await supabase
        .from('injection_leads')
        .select('country_code')
        .eq('injection_id', injection_id)
        .eq('status', 'sent');

      const baseline: Record<string, number> = {};
      for (const lead of sentLeads || []) {
        baseline[lead.country_code] = (baseline[lead.country_code] || 0) + 1;
      }
      console.log(`Setting GEO caps baseline for resume:`, baseline);

      // Count leads that were skipped due to GEO cap and can now be restored
      // These are leads with error_message containing "GEO cap"
      const { count: skippedGeoCount } = await supabase
        .from('injection_leads')
        .select('id', { count: 'exact', head: true })
        .eq('injection_id', injection_id)
        .eq('status', 'skipped')
        .ilike('error_message', '%GEO cap%');

      // Restore leads skipped due to GEO cap back to pending
      const { error: restoreError } = await supabase
        .from('injection_leads')
        .update({ status: 'pending', error_message: null, scheduled_at: null })
        .eq('injection_id', injection_id)
        .eq('status', 'skipped')
        .ilike('error_message', '%GEO cap%');

      if (restoreError) {
        console.error('Error restoring skipped leads:', restoreError);
      }

      // Check if there are any pending leads to process
      const { count: pendingCount } = await supabase
        .from('injection_leads')
        .select('id', { count: 'exact', head: true })
        .eq('injection_id', injection_id)
        .in('status', ['pending', 'scheduled']);

      if ((pendingCount || 0) === 0) {
        return new Response(JSON.stringify({ 
          error: 'No leads available to send. Add more leads or increase GEO caps first.',
          restored_count: skippedGeoCount || 0
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update skipped_count to reflect restored leads
      if ((skippedGeoCount || 0) > 0) {
        const newSkippedCount = Math.max(0, (injection.skipped_count || 0) - (skippedGeoCount || 0));
        await supabase
          .from('injections')
          .update({ skipped_count: newSkippedCount })
          .eq('id', injection_id);
      }

      // Set injection as running with next_scheduled_at = now AND save baseline
      await supabase
        .from('injections')
        .update({
          status: 'running',
          next_scheduled_at: new Date().toISOString(),
          geo_caps_baseline: baseline // Save current sent counts as baseline
        })
        .eq('id', injection_id);

      // Update injection object with new baseline for processNextLead
      injection.geo_caps_baseline = baseline;

      // Get advertiser to process first lead
      const advertiserIds = injection.advertiser_ids || [];
      if (advertiserIds.length > 0) {
        const advertiserIndex = (injection.sent_count || 0) % advertiserIds.length;
        const selectedAdvertiserId = advertiserIds[advertiserIndex];

        const { data: advertiser } = await supabase
          .from('advertisers')
          .select('*')
          .eq('id', selectedAdvertiserId)
          .single();

        if (advertiser) {
          // Process one lead immediately
          const didProcess = await processNextLead(supabase, injection, advertiser);
          
          if (didProcess) {
            // Calculate and set next send time
            const nextTime = await calculateNextSendTimeAsync(supabase, injection);
            console.log(`Injection resumed. Next send scheduled at: ${nextTime.toISOString()}`);
            
            await supabase
              .from('injections')
              .update({ next_scheduled_at: nextTime.toISOString() })
              .eq('id', injection_id);

            // Mark one upcoming lead as scheduled for UI visibility
            await markNextLeadAsScheduled(supabase, injection_id, nextTime, selectedAdvertiserId);
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Injection resumed',
        restored_count: skippedGeoCount || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (injection_id && action === 'start') {
      // Start a specific injection
      const { data: injection, error: injectionError } = await supabase
        .from('injections')
        .select('*')
        .eq('id', injection_id)
        .single();

      if (injectionError || !injection) {
        return new Response(JSON.stringify({ error: 'Injection not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get first advertiser from the array (or rotate based on sent count)
      const advertiserIds = injection.advertiser_ids || [];
      if (advertiserIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No advertisers configured for this injection' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Pick advertiser based on rotation
      const advertiserIndex = (injection.sent_count || 0) % advertiserIds.length;
      const selectedAdvertiserId = advertiserIds[advertiserIndex];

      const { data: advertiser } = await supabase
        .from('advertisers')
        .select('*')
        .eq('id', selectedAdvertiserId)
        .single();

      if (!advertiser) {
        return new Response(JSON.stringify({ error: 'Advertiser not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== BASELINE CALCULATION FOR RESTARTING INJECTION ==========
      // If injection already has sent leads AND no baseline is set, save current sent counts as baseline
      // This allows GEO caps to be evaluated fresh from this point forward
      // Works for paused, completed, or any status with existing sent leads
      let geoBaseline: Record<string, number> | null = null;
      
      // Check if baseline needs to be set:
      // - Not a fresh draft (has sent leads)
      // - Doesn't already have a baseline set
      // - Only for COMPLETED injections being restarted, NOT paused ones
      // Paused injections should continue from where they left off without resetting progress
      if (!injection.geo_caps_baseline && injection.status !== 'paused') {
        const { data: sentLeads } = await supabase
          .from('injection_leads')
          .select('country_code')
          .eq('injection_id', injection_id)
          .eq('status', 'sent');

        if (sentLeads && sentLeads.length > 0) {
          geoBaseline = {};
          for (const lead of sentLeads) {
            geoBaseline[lead.country_code] = (geoBaseline[lead.country_code] || 0) + 1;
          }
          console.log(`Setting GEO caps baseline on start (${injection.status} injection with ${sentLeads.length} sent leads):`, geoBaseline);
          
          // Update injection object for processNextLead
          injection.geo_caps_baseline = geoBaseline;
        }
      }

      // SIMPLIFIED FLOW: Just send first lead immediately and set next_scheduled_at
      // No pre-scheduling of individual leads needed
      
      // Set injection as running with next_scheduled_at = now (to trigger immediately)
      // Also save baseline if calculated
      const updatePayload: Record<string, unknown> = { 
        status: 'running',
        next_scheduled_at: new Date().toISOString()
      };
      if (geoBaseline) {
        updatePayload.geo_caps_baseline = geoBaseline;
      }
      
      await supabase
        .from('injections')
        .update(updatePayload)
        .eq('id', injection_id);

      // ========== SAFEGUARD: Check if enough time has passed since last send ==========
      // This prevents race conditions when resuming (cron might also trigger)
      const minDelay = injection.smart_mode ? 30 : (injection.min_delay_seconds || 30);
      
      const { data: lastSentLead } = await supabase
        .from('injection_leads')
        .select('sent_at')
        .eq('injection_id', injection_id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let shouldProcessNow = true;
      if (lastSentLead?.sent_at) {
        const lastSentTime = new Date(lastSentLead.sent_at);
        const elapsedSeconds = (Date.now() - lastSentTime.getTime()) / 1000;
        
        if (elapsedSeconds < minDelay) {
          // Too soon - don't process now, just schedule
          shouldProcessNow = false;
          const waitSeconds = Math.ceil(minDelay - elapsedSeconds);
          const nextTime = new Date(Date.now() + waitSeconds * 1000);
          console.log(`Start action: Only ${Math.floor(elapsedSeconds)}s since last send, scheduling in ${waitSeconds}s (min_delay=${minDelay}s)`);
          
          await supabase
            .from('injections')
            .update({ next_scheduled_at: nextTime.toISOString() })
            .eq('id', injection_id);
            
          await markNextLeadAsScheduled(supabase, injection_id, nextTime, selectedAdvertiserId);
        }
      }
      
      if (shouldProcessNow) {
        // Process one lead immediately
        const didProcess = await processNextLead(supabase, injection, advertiser);
        
        if (didProcess) {
          // Calculate and set next send time
          const nextTime = await calculateNextSendTimeAsync(supabase, injection);
          console.log(`Injection started. Next send scheduled at: ${nextTime.toISOString()}`);
          
          await supabase
            .from('injections')
            .update({ next_scheduled_at: nextTime.toISOString() })
            .eq('id', injection_id);

          // Mark one upcoming lead as scheduled for UI visibility
          await markNextLeadAsScheduled(supabase, injection_id, nextTime, selectedAdvertiserId);
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Injection started' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Simple lock: Use atomic update on injection status to prevent concurrent processing
    // Each injection can only be processed by one worker at a time

    // First, recover any leads stuck in 'sending' status for more than 5 minutes
    // Reset them to 'pending' so they get picked up in the next cycle
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from('injection_leads')
      .update({ status: 'pending', scheduled_at: null })
      .eq('status', 'sending')
      .lt('scheduled_at', fiveMinutesAgo);

    // Process all running injections (for cron/scheduled execution)
    // Check for injections due within the next 30 seconds to compensate for polling latency
    const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString();
    const { data: runningInjections } = await supabase
      .from('injections')
      .select('*')
      .eq('status', 'running')
      .lte('next_scheduled_at', thirtySecondsFromNow);

    let processed = 0;
    for (const injection of runningInjections || []) {
      const advertiserIds = injection.advertiser_ids || [];
      if (advertiserIds.length === 0) continue;

      // ========== SAFEGUARD: Enforce minimum delay between sends ==========
      // Check the last sent lead's timestamp and ensure min_delay has passed
      const minDelay = injection.min_delay_seconds || 30;
      
      const { data: lastSentLead } = await supabase
        .from('injection_leads')
        .select('sent_at')
        .eq('injection_id', injection.id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastSentLead?.sent_at) {
        const lastSentTime = new Date(lastSentLead.sent_at);
        const elapsedSeconds = (Date.now() - lastSentTime.getTime()) / 1000;
        
        if (elapsedSeconds < minDelay) {
          // Too soon - skip this injection for now, reschedule properly
          const waitSeconds = Math.ceil(minDelay - elapsedSeconds);
          const nextTime = new Date(Date.now() + waitSeconds * 1000);
          console.log(`Injection ${injection.id}: Only ${Math.floor(elapsedSeconds)}s since last send, waiting ${waitSeconds}s more (min_delay=${minDelay}s)`);
          
          await supabase
            .from('injections')
            .update({ next_scheduled_at: nextTime.toISOString() })
            .eq('id', injection.id);
          continue;
        }
      }

      // SIMPLIFIED FLOW: When injection.next_scheduled_at is due, immediately send ONE lead
      // No pre-scheduling of individual leads - just send and calculate next time
      
      // Rotate through advertisers - pick one based on sent count
      const advertiserIndex = (injection.sent_count || 0) % advertiserIds.length;
      const selectedAdvertiserId = advertiserIds[advertiserIndex];

      const { data: advertiser } = await supabase
        .from('advertisers')
        .select('*')
        .eq('id', selectedAdvertiserId)
        .single();

      if (advertiser) {
        const didProcess = await processNextLead(supabase, injection, advertiser);
        if (didProcess) {
          processed++;
          injection.sent_count = (injection.sent_count || 0) + 1;
        }
      }

      // Check if all GEO caps have been reached
      let allCapsReached = false;
      if (injection.geo_caps && Object.keys(injection.geo_caps).length > 0) {
        allCapsReached = true;
        for (const [countryCode, cap] of Object.entries(injection.geo_caps as Record<string, number>)) {
          const { count: sentForGeo } = await supabase
            .from('injection_leads')
            .select('id', { count: 'exact', head: true })
            .eq('injection_id', injection.id)
            .eq('country_code', countryCode)
            .eq('status', 'sent');
          
          if ((sentForGeo || 0) < cap) {
            allCapsReached = false;
            break;
          }
        }
      }

      // Check remaining leads
      const { count: remainingCount } = await supabase
        .from('injection_leads')
        .select('id', { count: 'exact', head: true })
        .eq('injection_id', injection.id)
        .in('status', ['pending', 'scheduled', 'sending']);

      // Complete if no remaining leads OR all GEO caps reached
      if (remainingCount === 0 || allCapsReached) {
        // Skip remaining leads if caps reached
        if (allCapsReached && remainingCount && remainingCount > 0) {
          await supabase
            .from('injection_leads')
            .update({ status: 'skipped', error_message: 'GEO cap target reached' })
            .eq('injection_id', injection.id)
            .in('status', ['pending', 'scheduled']);
        }
        
        await supabase
          .from('injections')
          .update({ status: 'completed', next_scheduled_at: null })
          .eq('id', injection.id);
      } else {
        // Calculate next send time and update injection.next_scheduled_at
        // This is the ONLY place where timing is calculated
        const nextTime = await calculateNextSendTimeAsync(supabase, injection);
        console.log(`Next send for injection ${injection.id} scheduled at: ${nextTime.toISOString()}`);
        
        await supabase
          .from('injections')
          .update({ next_scheduled_at: nextTime.toISOString() })
          .eq('id', injection.id);

        // Mark one upcoming lead as scheduled for UI visibility
        await markNextLeadAsScheduled(supabase, injection.id, nextTime, selectedAdvertiserId);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Send injection error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
