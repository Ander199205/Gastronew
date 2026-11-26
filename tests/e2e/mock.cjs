// Backend falso de Supabase para probar la interfaz (el contenedor no llega a supabase.co)
const fx = require('./fixtures.json');
const db = {
  restaurants: [fx.restaurant], menu_categories: fx.cats.map(c => ({ ...c, restaurant_id: 'r1', active: true })),
  menu_items: fx.items.map(i => ({ ...i, restaurant_id: 'r1' })), nearby_places: fx.nearby.map(n => ({ ...n, restaurant_id: 'r1', active: true })),
  tables: fx.tables, staff: fx.staff, platform_admins: [], visits: [], orders: [], order_items: [], messages: [],
};
let seq = 1; const id = p => `${p}${seq++}`; const now = () => new Date().toISOString();
function filt(rows, params) {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    rows = rows.filter(r => {
      const x = r[k] === null || r[k] === undefined ? 'null' : String(r[k]);
      if (op === 'eq') return x === val;
      if (op === 'neq') return x !== val;
      if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/"/g, '')).includes(x);
      return true;
    });
  }
  const o = params.get('order');
  if (o) { const [f, dir] = o.split('.'); rows = [...rows].sort((a, b) => (a[f] > b[f] ? 1 : a[f] < b[f] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
  return rows;
}
function visitByToken(t) { return db.visits.find(v => v.guest_token === t); }
function insertOrder(v, items, note, source, staff) {
  const num = db.orders.length + 1;
  const o = { id: id('o'), restaurant_id: 'r1', visit_id: v.id, table_id: v.table_id, number: num, source, created_by: staff, status: source === 'waiter' ? 'accepted' : 'new', note, created_at: now(), accepted_at: source === 'waiter' ? now() : null, ready_at: null, served_at: null };
  for (const l of items) {
    const it = db.menu_items.find(i => i.id === l.item_id);
    if (it.sold_out) throw new Error('sold_out:' + it.id);
    db.order_items.push({ id: id('oi'), order_id: o.id, restaurant_id: 'r1', menu_item_id: it.id, name: it.name.de, unit_price_cents: it.price_cents, vat_rate: it.vat_rate, qty: l.qty, station: it.station, note: null });
  }
  db.orders.push(o);
  if (v.status === 'bill_requested') v.status = 'open';
  return o.id;
}
const rpc = {
  guest_open(a) {
    const t = db.tables.find(t => t.number === a.p_table && t.qr_key === a.p_key);
    if (!t) throw new Error('invalid_table');
    let v = db.visits.find(v => v.table_id === t.id && v.status !== 'closed');
    if (v) return { token: v.guest_token, joined: true };
    v = { id: id('v'), restaurant_id: 'r1', table_id: t.id, waiter_id: 's1', guest_token: id('tok'), guest_name: a.p_name, guests: a.p_guests, language: a.p_lang, opened_by: 'guest', status: 'open', tip_percent: 0, rating: null, created_at: now(), bill_requested_at: null, closed_at: null };
    db.visits.push(v);
    db.messages.push({ id: id('m'), restaurant_id: 'r1', visit_id: v.id, sender: 'system', staff_id: null, phrase_key: 'sys_checkin', phrase_args: { name: a.p_name || '', guests: a.p_guests }, body: null, read_by_staff: false, created_at: now() });
    return { token: v.guest_token, joined: false };
  },
  guest_state(a) {
    const v = visitByToken(a.p_token); if (!v) return null;
    const t = db.tables.find(t => t.id === v.table_id);
    return { visit: { status: v.status, guest_name: v.guest_name, guests: v.guests, table: t.number, waiter: 'Carmen', tip_percent: v.tip_percent, rating: v.rating, created_at: v.created_at },
      orders: db.orders.filter(o => o.visit_id === v.id).map(o => ({ id: o.id, number: o.number, status: o.status, source: o.source, created_at: o.created_at, items: db.order_items.filter(i => i.order_id === o.id).map(i => ({ item_id: i.menu_item_id, name: i.name, qty: i.qty, unit_price_cents: i.unit_price_cents, vat_rate: i.vat_rate })) })),
      messages: db.messages.filter(m => m.visit_id === v.id).map(m => ({ ...m, staff: m.staff_id ? 'Carmen' : null })) };
  },
  guest_place_order(a) { return insertOrder(visitByToken(a.p_token), a.p_items, a.p_note, 'guest', null); },
  guest_send_message(a) { const v = visitByToken(a.p_token); db.messages.push({ id: id('m'), restaurant_id: 'r1', visit_id: v.id, sender: 'guest', staff_id: null, phrase_key: a.p_phrase_key, phrase_args: null, body: a.p_body, read_by_staff: false, created_at: now() }); return null; },
  guest_request_bill(a) { const v = visitByToken(a.p_token); v.status = 'bill_requested'; v.tip_percent = a.p_tip_percent; db.messages.push({ id: id('m'), restaurant_id: 'r1', visit_id: v.id, sender: 'system', phrase_key: 'sys_bill', phrase_args: { tip: a.p_tip_percent }, body: null, read_by_staff: false, created_at: now() }); return null; },
  guest_rate(a) { visitByToken(a.p_token).rating = a.p_stars; return null; },
  staff_set_order_status(a) { const o = db.orders.find(o => o.id === a.p_order); o.status = a.p_status; if (a.p_status === 'accepted') o.accepted_at = now(); return null; },
  staff_send_message(a) { db.messages.push({ id: id('m'), restaurant_id: 'r1', visit_id: a.p_visit, sender: 'staff', staff_id: 's1', phrase_key: a.p_phrase_key, phrase_args: null, body: a.p_body, read_by_staff: true, created_at: now() }); return null; },
  staff_mark_read(a) { db.messages.filter(m => m.visit_id === a.p_visit).forEach(m => m.read_by_staff = true); return null; },
  staff_close_visit(a) { const v = db.visits.find(v => v.id === a.p_visit); v.status = 'closed'; v.closed_at = now(); return null; },
  staff_open_visit(a) { let v = db.visits.find(v => v.table_id === a.p_table && v.status !== 'closed'); if (!v) { v = { id: id('v'), restaurant_id: 'r1', table_id: a.p_table, waiter_id: 's1', guest_token: id('tok'), guest_name: null, guests: a.p_guests, language: 'de', opened_by: 'waiter', status: 'open', tip_percent: 0, created_at: now() }; db.visits.push(v); } return v.id; },
  staff_place_order(a) { return insertOrder(db.visits.find(v => v.id === a.p_visit), a.p_items, a.p_note, 'waiter', 's1'); },
  staff_set_sold_out(a) { db.menu_items.find(i => i.id === a.p_item).sold_out = a.p_sold_out; return null; },
};
function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', exp, aud: 'authenticated', email: 'carmen@test' })}.sig`;
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'carmen@test', app_metadata: {}, user_metadata: {}, created_at: now() };

async function install(context) {
  await context.route(/supabase\.co\/(rest|auth|realtime)\//, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname.startsWith('/auth/v1/token')) return send(200, { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user });
    if (u.pathname.startsWith('/auth/v1/user')) return send(200, user);
    if (u.pathname.startsWith('/auth/v1/logout')) return send(204, {});
    const m = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      try { return send(200, rpc[m[1]](JSON.parse(req.postData() || '{}'))); }
      catch (e) { return send(400, { code: 'P0001', message: e.message, details: null, hint: null }); }
    }
    const t = u.pathname.match(/^\/rest\/v1\/(\w+)/);
    if (t) {
      const rows = filt(db[t[1]] || [], u.searchParams);
      if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) {
        if (!rows.length) return send(406, { code: 'PGRST116', message: 'no rows', details: 'The result contains 0 rows' });
        return send(200, rows[0]);
      }
      return send(200, rows);
    }
    return route.abort();
  });
}
module.exports = { install, db };
