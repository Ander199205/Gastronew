// abWeb Gastro · staff-admin
// Alta de personal y de restaurantes. Necesita la clave de servicio, por eso vive aquí y no en el navegador.
// Acciones (POST JSON, con la sesión del usuario en Authorization):
//   create_staff      { restaurant_id, email, display_name, role }        → dueño/encargado del restaurante
//   reset_password    { staff_id }                                         → dueño/encargado del restaurante
//   create_restaurant { name, slug, city?, plan?, tables?, owner_email, owner_name } → solo admin de abWeb
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ROLES = ['owner', 'manager', 'waiter', 'kitchen'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contraseña provisional legible (sin 0/O, 1/l): xxxx-xxxx-xxxx */
function tempPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(b, (x) => a[x % a.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

async function isAdmin(uid: string) {
  const { data } = await db.from('platform_admins').select('user_id').eq('user_id', uid).maybeSingle();
  return !!data;
}
async function roleIn(uid: string, rid: string): Promise<string | null> {
  const { data } = await db.from('staff').select('role').eq('user_id', uid).eq('restaurant_id', rid).eq('active', true).maybeSingle();
  return data?.role ?? null;
}

/** Crea la cuenta o reutiliza la que ya existe con ese e-mail. Devuelve la contraseña solo si la cuenta es nueva. */
async function ensureUser(email: string, name: string): Promise<{ id: string; password: string | null }> {
  const { data: existing } = await db.rpc('_user_id_by_email', { p_email: email });
  if (existing) return { id: existing as string, password: null };
  const password = tempPassword();
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: name, must_change_password: true },
  });
  if (error || !data.user) throw new Error(error?.message || 'create_user_failed');
  return { id: data.user.id, password };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: who } = await db.auth.getUser(jwt);
    const uid = who.user?.id;
    if (!uid) return json({ error: 'unauthorized' }, 401);
    const body = await req.json();
    const admin = await isAdmin(uid);

    if (body.action === 'create_staff') {
      const rid = String(body.restaurant_id || '');
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.display_name || '').trim().slice(0, 40);
      const role = String(body.role || '');
      if (!EMAIL.test(email) || !name || !ROLES.includes(role)) return json({ error: 'invalid' }, 400);
      const mine = admin ? 'owner' : await roleIn(uid, rid);
      if (mine !== 'owner' && mine !== 'manager') return json({ error: 'forbidden' }, 403);
      if (role === 'owner' && mine !== 'owner') return json({ error: 'only_owner' }, 403);
      const user = await ensureUser(email, name);
      const { data: dup } = await db.from('staff').select('id,active').eq('restaurant_id', rid).eq('user_id', user.id).maybeSingle();
      let staffId: string;
      if (dup) {
        await db.from('staff').update({ active: true, role, display_name: name, email }).eq('id', dup.id);
        staffId = dup.id;
      } else {
        const { data: s, error } = await db.from('staff')
          .insert({ restaurant_id: rid, user_id: user.id, display_name: name, role, email }).select('id').single();
        if (error) throw error;
        staffId = s.id;
      }
      return json({ staff_id: staffId, email, password: user.password, existing: !user.password });
    }

    if (body.action === 'reset_password') {
      const { data: st } = await db.from('staff').select('id,restaurant_id,user_id,role,email').eq('id', body.staff_id).maybeSingle();
      if (!st?.user_id) return json({ error: 'not_found' }, 404);
      const mine = admin ? 'owner' : await roleIn(uid, st.restaurant_id);
      if (mine !== 'owner' && mine !== 'manager') return json({ error: 'forbidden' }, 403);
      if (st.role === 'owner' && mine !== 'owner') return json({ error: 'only_owner' }, 403);
      if (!admin) {
        // solo si esa persona no trabaja también en otro restaurante que yo no gestiono
        const { data: rows } = await db.from('staff').select('restaurant_id').eq('user_id', st.user_id).eq('active', true);
        for (const r of rows || []) {
          const m = await roleIn(uid, r.restaurant_id);
          if (m !== 'owner' && m !== 'manager') return json({ error: 'other_restaurant' }, 403);
        }
        if (await isAdmin(st.user_id)) return json({ error: 'forbidden' }, 403);
      }
      const password = tempPassword();
      const { error } = await db.auth.admin.updateUserById(st.user_id, { password, user_metadata: { must_change_password: true } });
      if (error) throw error;
      return json({ email: st.email, password });
    }

    if (body.action === 'create_restaurant') {
      if (!admin) return json({ error: 'forbidden' }, 403);
      const name = String(body.name || '').trim().slice(0, 80);
      const slug = String(body.slug || '').trim().toLowerCase();
      const email = String(body.owner_email || '').trim().toLowerCase();
      const ownerName = String(body.owner_name || '').trim().slice(0, 40);
      const plan = body.plan === 'carta' ? 'carta' : 'mesa';
      const n = Math.max(0, Math.min(80, Number(body.tables) || 0));
      if (!name || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) || !EMAIL.test(email) || !ownerName) return json({ error: 'invalid' }, 400);
      const { data: taken } = await db.from('restaurants').select('id').eq('slug', slug).maybeSingle();
      if (taken) return json({ error: 'slug_taken' }, 409);
      const { data: r, error } = await db.from('restaurants').insert({
        name, slug, plan, city: body.city ? String(body.city).slice(0, 60) : null,
        theme: { primary: '#B4532A', accent: '#2F6B4F', bg: '#FBF6EF', font_heading: 'Fraunces', font_body: 'Instrument Sans', radius: '14px' },
      }).select('id').single();
      if (error) throw error;
      if (n) await db.from('tables').insert(Array.from({ length: n }, (_, i) => ({ restaurant_id: r.id, number: i + 1 })));
      await db.from('menu_categories').insert({ restaurant_id: r.id, name: { de: 'Speisen', en: 'Food' }, position: 0 });
      const user = await ensureUser(email, ownerName);
      await db.from('staff').insert({ restaurant_id: r.id, user_id: user.id, display_name: ownerName, role: 'owner', email });
      return json({ restaurant_id: r.id, slug, email, password: user.password, existing: !user.password });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'server', detail: String((e as Error).message || e) }, 500);
  }
});
