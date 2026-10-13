import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js?v=202610131530';

// supabase-js se carga desde vendor/supabase.js (copia fija, sin CDN).
// Si no cargó, supabase queda en null y app.js muestra el problema.
export const supabase = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
