/* Supabase simulado para la demo (VITE_DEMO=1): todo vive en memoria en la ventana principal,
   así la carta del cliente y la app del personal (en iframes) comparten datos y "tiempo real". */
import fx from './fixtures.json';

type Row = Record<string, unknown> & { id: string };
type Db = Record<string, Row[]>;
type Listener = () => void;
interface Shared { db: Db; listeners: Set<Listener>; seq: number; blobs: Record<string, string> }

function freshDb(): Db {
  return {
    restaurants: [{ ...(fx.restaurant as unknown as Row), active: true }],
    menu_categories: fx.cats.map((c) => ({ ...c, restaurant_id: 'r1', active: true })),
    menu_items: fx.items.map((i) => ({ ...i, restaurant_id: 'r1', sold_out: false, created_at: new Date().toISOString() })),
    nearby_places: fx.nearby.map((n, i) => ({ ...n, restaurant_id: 'r1', active: true, position: i })),
    tables: fx.tables as Row[], staff: fx.staff.map((x) => ({ ...x, email: `${x.user_id === 'u1' ? 'carmen' : x.user_id === 'u2' ? 'lucia' : 'kueche'}@casalucia.demo` })) as Row[],
    platform_admins: [{ id: 'pa1', user_id: 'u4' }],
    visits: [], orders: [], order_items: [], messages: [],
  } as unknown as Db;
}

function shared(): Shared {
  let w: Window & { __abgDemo?: Shared } = window;
  try { if (window.top && window.top !== window && (window.top as Window & { __abgDemo?: Shared }).location.href) w = window.top as typeof w; } catch { /* otro origen */ }
  if (!w.__abgDemo) w.__abgDemo = { db: freshDb(), listeners: new Set(), seq: 1, blobs: {} };
  return w.__abgDemo;
}
export function resetDemo() { const s = shared(); s.db = freshDb(); s.listeners.forEach((l) => l()); }

const S = () => shared();
const db = () => S().db;
const id = (p: string) => `${p}${S().seq++}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();
const notify = () => window.setTimeout(() => S().listeners.forEach((l) => { try { l(); } catch { /* frame cerrado */ } }), 30);
const ok = <T,>(data: T) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

// ------------------------------------------------------------ consultas tipo PostgREST
class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private sort: [string, boolean] | null = null;
  private mode: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private payload: unknown = null;
  private pick: 'one' | 'maybe' | null = null;
  private table: string;
  constructor(table: string) { this.table = table; }
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => String(r[c]) === String(v)); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => String(r[c]) !== String(v)); return this; }
  in(c: string, vs: unknown[]) { const s = vs.map(String); this.filters.push((r) => s.includes(String(r[c]))); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.sort = [c, o?.ascending !== false]; return this; }
  limit() { return this; }
  update(p: unknown) { this.mode = 'update'; this.payload = p; return this; }
  insert(p: unknown) { this.mode = 'insert'; this.payload = p; return this; }
  delete() { this.mode = 'delete'; return this; }
  maybeSingle() { this.pick = 'maybe'; return this; }
  single() { this.pick = 'one'; return this; }
  then<R>(res: (v: { data: unknown; error: { message: string } | null }) => R, rej?: (e: unknown) => R) { return this.run().then(res, rej); }
  private rows() {
    let rows = (db()[this.table] ||= []).filter((r) => this.filters.every((f) => f(r)));
    if (this.sort) { const [c, asc] = this.sort; rows = [...rows].sort((a, b) => (a[c]! > b[c]! ? 1 : a[c]! < b[c]! ? -1 : 0) * (asc ? 1 : -1)); }
    return rows;
  }
  private run() {
    if (this.mode === 'insert') {
      const arr = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const ins = arr.map((r) => ({ active: true, ...r, id: (r.id as string) || id(this.table.slice(0, 2)) }));
      db()[this.table].push(...ins); notify(); return ok(ins);
    }
    const rows = this.rows();
    if (this.mode === 'update') { rows.forEach((r) => Object.assign(r, this.payload)); notify(); return ok(rows); }
    if (this.mode === 'delete') { db()[this.table] = db()[this.table].filter((r) => !rows.includes(r)); notify(); return ok(rows); }
    const copy = JSON.parse(JSON.stringify(rows));
    if (this.pick === 'one') return copy.length ? ok(copy[0]) : fail('no rows');
    if (this.pick === 'maybe') return ok(copy[0] ?? null);
    return ok(copy);
  }
}

// ------------------------------------------------------------ funciones (como las de SQL)
const T = () => db();
const visitByToken = (t: unknown) => T().visits.find((v) => v.guest_token === t);
function insertOrder(v: Row, items: { item_id: string; qty: number; note?: string }[], note: string | null, source: string, staff: string | null) {
  if (!items?.length) throw new Error('empty_order');
  const o: Row = { id: id('o'), restaurant_id: 'r1', visit_id: v.id, table_id: v.table_id, number: T().orders.length + 1, source, created_by: staff,
    status: source === 'waiter' ? 'accepted' : 'new', note, created_at: now(), accepted_at: source === 'waiter' ? now() : null, ready_at: null, served_at: null };
  for (const l of items) {
    const it = T().menu_items.find((i) => i.id === l.item_id);
    if (!it) throw new Error('unknown_item');
    if (it.sold_out) throw new Error('sold_out:' + it.id);
    T().order_items.push({ id: id('oi'), order_id: o.id, restaurant_id: 'r1', menu_item_id: it.id, name: (it.name as Record<string, string>).de,
      unit_price_cents: it.price_cents, vat_rate: it.vat_rate, qty: l.qty, station: it.station, note: l.note || null });
  }
  T().orders.push(o);
  if (v.status === 'bill_requested') v.status = 'open';
  return o.id;
}
const msg = (visit: string, sender: string, extra: Record<string, unknown>) =>
  T().messages.push({ id: id('m'), restaurant_id: 'r1', visit_id: visit, sender, staff_id: null, phrase_key: null, phrase_args: null, body: null, read_by_staff: false, created_at: now(), ...extra });
const myStaff = () => T().staff.find((s) => s.user_id === session?.user.id)?.id ?? null;

const RPC: Record<string, (a: Record<string, unknown>) => unknown> = {
  guest_open(a) {
    const t = T().tables.find((t) => t.number === a.p_table && t.qr_key === a.p_key && t.active !== false);
    if (!t) throw new Error('invalid_table');
    let v = T().visits.find((v) => v.table_id === t.id && v.status !== 'closed');
    if (v) return { token: v.guest_token, joined: true };
    v = { id: id('v'), restaurant_id: 'r1', table_id: t.id, waiter_id: t.waiter_id, guest_token: id('tok'), guest_name: a.p_name, guests: a.p_guests,
      language: a.p_lang, opened_by: 'guest', status: 'open', tip_percent: 0, rating: null, created_at: now(), bill_requested_at: null, closed_at: null };
    T().visits.push(v);
    msg(v.id, 'system', { phrase_key: 'sys_checkin', phrase_args: { name: a.p_name || '', guests: a.p_guests } });
    return { token: v.guest_token, joined: false };
  },
  guest_state(a) {
    const v = visitByToken(a.p_token); if (!v) return null;
    const t = T().tables.find((t) => t.id === v.table_id)!;
    const w = T().staff.find((s) => s.id === v.waiter_id);
    return { visit: { status: v.status, guest_name: v.guest_name, guests: v.guests, table: t.number, waiter: w?.display_name ?? null, tip_percent: v.tip_percent, rating: v.rating, created_at: v.created_at },
      orders: T().orders.filter((o) => o.visit_id === v.id).map((o) => ({ id: o.id, number: o.number, status: o.status, source: o.source, created_at: o.created_at,
        items: T().order_items.filter((i) => i.order_id === o.id).map((i) => ({ item_id: i.menu_item_id, name: i.name, qty: i.qty, unit_price_cents: i.unit_price_cents, vat_rate: i.vat_rate })) })),
      messages: T().messages.filter((m) => m.visit_id === v.id).map((m) => ({ ...m, staff: T().staff.find((s) => s.id === m.staff_id)?.display_name ?? null })) };
  },
  guest_place_order(a) { const v = visitByToken(a.p_token); if (!v || v.status === 'closed') throw new Error('unknown_visit'); return insertOrder(v, a.p_items as never, a.p_note as string, 'guest', null); },
  guest_send_message(a) { const v = visitByToken(a.p_token); if (!v) throw new Error('unknown_visit'); msg(v.id, 'guest', { phrase_key: a.p_phrase_key, body: a.p_body }); return null; },
  guest_request_bill(a) { const v = visitByToken(a.p_token)!; v.status = 'bill_requested'; v.tip_percent = a.p_tip_percent; v.bill_requested_at = now(); msg(v.id, 'system', { phrase_key: 'sys_bill', phrase_args: { tip: a.p_tip_percent } }); return null; },
  guest_rate(a) { visitByToken(a.p_token)!.rating = a.p_stars; return null; },
  staff_set_order_status(a) { const o = T().orders.find((o) => o.id === a.p_order)!; o.status = a.p_status; o[`${a.p_status}_at`] = now(); return null; },
  staff_send_message(a) { msg(a.p_visit as string, 'staff', { staff_id: myStaff(), phrase_key: a.p_phrase_key, body: a.p_body, read_by_staff: true }); return null; },
  staff_mark_read(a) { T().messages.filter((m) => m.visit_id === a.p_visit).forEach((m) => { m.read_by_staff = true; }); return null; },
  staff_close_visit(a) {
    const v = T().visits.find((v) => v.id === a.p_visit)!; v.status = 'closed'; v.closed_at = now();
    T().orders.filter((o) => o.visit_id === v.id && ['new', 'accepted', 'ready'].includes(o.status as string)).forEach((o) => { o.status = 'served'; });
    msg(v.id, 'system', { phrase_key: 'sys_closed' }); return null;
  },
  staff_open_visit(a) {
    let v = T().visits.find((v) => v.table_id === a.p_table && v.status !== 'closed');
    if (!v) { v = { id: id('v'), restaurant_id: 'r1', table_id: a.p_table, waiter_id: myStaff(), guest_token: id('tok'), guest_name: null, guests: a.p_guests, language: 'de', opened_by: 'waiter', status: 'open', tip_percent: 0, created_at: now() }; T().visits.push(v); }
    return v.id;
  },
  staff_place_order(a) { return insertOrder(T().visits.find((v) => v.id === a.p_visit)!, a.p_items as never, a.p_note as string, 'waiter', myStaff()); },
  admin_overview() {
    return T().restaurants.map((r) => ({ ...r, staff: T().staff.filter((x) => x.restaurant_id === r.id && x.active).length,
      tables: T().tables.filter((x) => (x.restaurant_id ?? 'r1') === r.id).length, items: T().menu_items.filter((x) => x.restaurant_id === r.id).length,
      visits_30d: T().visits.filter((x) => x.restaurant_id === r.id).length, orders_30d: T().orders.filter((x) => x.restaurant_id === r.id).length,
      last_activity: T().visits.filter((x) => x.restaurant_id === r.id).map((x) => x.created_at as string).sort().pop() ?? null, created_at: r.created_at ?? now() }));
  },
  staff_set_sold_out(a) { T().menu_items.find((i) => i.id === a.p_item)!.sold_out = a.p_sold_out; return null; },
};

// ------------------------------------------------------------ auth (cuentas de demo)
const DEMO_USERS: Record<string, string> = { 'carmen@casalucia.demo': 'u1', 'lucia@casalucia.demo': 'u2', 'kueche@casalucia.demo': 'u3', 'admin@casalucia.demo': 'u4' };
const demoPw = () => `demo-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;

/** Edge Function staff-admin simulada (sin cuentas reales: el e-mail nuevo no puede entrar en la demo). */
const FUNCTIONS: Record<string, (b: Record<string, unknown>) => unknown> = {
  'staff-admin'(b) {
    if (b.action === 'create_staff') {
      const email = String(b.email).toLowerCase();
      const dup = T().staff.find((x) => x.restaurant_id === b.restaurant_id && x.email === email);
      if (dup) { Object.assign(dup, { active: true, role: b.role, display_name: b.display_name }); return { staff_id: dup.id, email, password: null, existing: true }; }
      const sid = id('s');
      T().staff.push({ id: sid, restaurant_id: b.restaurant_id as string, user_id: id('u'), display_name: b.display_name, role: b.role, email, active: true });
      return { staff_id: sid, email, password: demoPw(), existing: false };
    }
    if (b.action === 'reset_password') { const st = T().staff.find((x) => x.id === b.staff_id)!; return { email: st.email, password: demoPw() }; }
    if (b.action === 'create_restaurant') {
      if (T().restaurants.some((r) => r.slug === b.slug)) throw new Error('slug_taken');
      const rid = id('r');
      T().restaurants.push({ ...(T().restaurants[0]), id: rid, slug: b.slug as string, name: b.name as string, city: b.city, plan: b.plan, active: true, created_at: now() });
      for (let i = 1; i <= Number(b.tables || 0); i++) T().tables.push({ id: id('t'), restaurant_id: rid, number: i, seats: 4, qr_key: `k${i}`, waiter_id: null, label: null, active: true });
      T().staff.push({ id: id('s'), restaurant_id: rid, user_id: id('u'), display_name: b.owner_name, role: 'owner', email: b.owner_email, active: true });
      return { restaurant_id: rid, slug: b.slug, email: b.owner_email, password: demoPw(), existing: false };
    }
    throw new Error('unknown_action');
  },
};
let session: { user: { id: string; email: string } } | null = null;
const authListeners = new Set<(e: string, s: typeof session) => void>();

export const fakeSupabase = {
  from: (t: string) => new Query(t),
  rpc(fn: string, args: Record<string, unknown>) {
    try { const r = RPC[fn](args || {}); if (!fn.startsWith('guest_state')) notify(); return ok(JSON.parse(JSON.stringify(r ?? null))); }
    catch (e) { return fail((e as Error).message); }
  },
  functions: {
    invoke(name: string, { body }: { body: Record<string, unknown> }) {
      try { const r = FUNCTIONS[name](body); notify(); return ok(r); }
      catch (e) { const code = (e as Error).message; return Promise.resolve({ data: null, error: { message: code, context: new Response(JSON.stringify({ error: code })) } }); }
    },
  },
  auth: {
    getSession: () => ok({ session }),
    updateUser: () => ok({ user: session?.user ?? null }),
    onAuthStateChange(cb: (e: string, s: typeof session) => void) { authListeners.add(cb); return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }; },
    signInWithPassword({ email }: { email: string }) {
      const uid = DEMO_USERS[email.toLowerCase()];
      if (!uid) return fail('invalid');
      session = { user: { id: uid, email } };
      authListeners.forEach((cb) => cb('SIGNED_IN', session));
      return ok({ session });
    },
    signOut() { session = null; authListeners.forEach((cb) => cb('SIGNED_OUT', null)); return ok(null); },
  },
  channel() {
    let fn: Listener | null = null;
    const ch = {
      on(_t: string, _f: unknown, cb: Listener) { fn = cb; return ch; },
      subscribe(cb?: (s: string) => void) { if (fn) S().listeners.add(fn); cb?.('SUBSCRIBED'); return ch; },
      _fn: () => fn,
    };
    return ch;
  },
  removeChannel(ch: { _fn: () => Listener | null }) { const f = ch._fn(); if (f) S().listeners.delete(f); },
  storage: {
    from: () => ({
      upload(path: string, blob: Blob) { S().blobs[path] = URL.createObjectURL(blob); return ok({ path }); },
      getPublicUrl: (path: string) => ({ data: { publicUrl: S().blobs[path] } }),
    }),
  },
};
