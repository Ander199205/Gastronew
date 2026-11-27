import { supabase } from './supabase';

export type StaffAdminResult = { password?: string | null; email?: string; existing?: boolean; staff_id?: string; restaurant_id?: string; slug?: string };

const MSG: Record<string, string> = {
  invalid: 'Bitte alle Felder richtig ausfüllen.',
  forbidden: 'Dafür fehlt Ihnen die Berechtigung.',
  only_owner: 'Nur Inhaber können Inhaber anlegen oder ändern.',
  other_restaurant: 'Diese Person arbeitet auch in einem anderen Restaurant. Bitte abWeb kontaktieren.',
  slug_taken: 'Diese Adresse (Slug) ist schon vergeben.',
  not_found: 'Nicht gefunden.',
  unauthorized: 'Bitte neu anmelden.',
};

/** Ruft die Edge Function staff-admin auf (Personal anlegen, Passwort zurücksetzen, Restaurant anlegen). */
export async function staffAdmin(action: string, payload: Record<string, unknown>): Promise<StaffAdminResult> {
  const { data, error } = await supabase.functions.invoke('staff-admin', { body: { action, ...payload } });
  if (error) {
    let code = '';
    try { code = (await (error as { context?: Response }).context?.json())?.error || ''; } catch { /* sin cuerpo */ }
    throw new Error(MSG[code] || 'Das hat nicht geklappt. Bitte später erneut versuchen.');
  }
  return data as StaffAdminResult;
}
