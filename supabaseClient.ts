
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação básica para evitar crash da aplicação
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

if (!supabaseUrl || !isValidUrl(supabaseUrl)) {
  console.error('CRITICAL: Supabase URL is missing or invalid. Check .env.local');
}

export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'https://setup-needed.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
