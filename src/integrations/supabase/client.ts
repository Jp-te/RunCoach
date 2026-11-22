import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** false => o App mostra uma tela de configuração em vez de quebrar. */
export const isSupabaseConfigured = Boolean(url && key);

// Somente a URL do projeto e a Publishable Key (pública por design) são usadas aqui.
// A segurança dos dados vem do RLS no banco — nunca coloque Secret Keys no frontend.
export const supabase = createClient(url || 'http://localhost:54321', key || 'sem-chave', {
  auth: {
    flowType: 'pkce', // link de recuperação chega como ?code=..., compatível com HashRouter
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
