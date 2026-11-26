import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fakeSupabase } from '../demo/fakeSupabase';

/** Modo demo (VITE_DEMO=1): datos de prueba en memoria, sin conexión a Supabase. */
export const DEMO = import.meta.env.VITE_DEMO === '1';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_KEY as string;

if (!DEMO && (!url || !key)) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_KEY (ver .env.example)');
}

export const supabase: SupabaseClient = DEMO
  ? (fakeSupabase as unknown as SupabaseClient)
  : createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
