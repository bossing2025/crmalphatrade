import { loadEnv } from 'vite';
const env = loadEnv('production', process.cwd(), '');
console.log('VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', env.VITE_SUPABASE_PUBLISHABLE_KEY);
