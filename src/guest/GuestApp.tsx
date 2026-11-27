import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GUEST_I18N, GUEST_LANGS, type Lang } from '../i18n/guest';
import type { Category, GuestState, MenuItem, NearbyPlace, OrderStatus, Restaurant } from '../lib/types';
import { errKey, eur, fill, themeVars, timeHM, tx } from '../lib/util';
import '../styles/guest.css';

type Screen = 'menu' | 'chat' | 'bill';
const POLL_MS = 4000;
const STATUS_KEY: Record<OrderStatus, string> = {
  new: 'st_neu', accepted: 'st_kueche', ready: 'st_fertig', served: 'st_serviert', cancelled: 'st_cancelled',
};
const GUEST_QUICK = ['q_water', 'q_come', 'q_gluten', 'q_pay', 'q_split', 'q_card'];

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* privado */ } },
};

function pickLang(r: Restaurant | null): Lang {
  const saved = store.get('abg:lang') as Lang | null;
  const ok = (l: string | null): l is Lang => !!l && GUEST_LANGS.some(([c]) => c === l) && (!r || r.languages.includes(l));
  if (ok(saved)) return saved;
  const nav = (navigator.language || 'de').slice(0, 2);
  if (ok(nav)) return nav;
  return (r?.default_language as Lang) || 'de';
}

export default function GuestApp() {
  const { slug = '', table: tableParam } = useParams();
  const [sp] = useSearchParams();
  const table = tableParam ? parseInt(tableParam, 10) : null;
  const qrKey = sp.get('k') || '';
  const tokenKey = `abg:${slug}:${table}`;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(() => pickLang(null));
  const [token, setToken] = useState<string | null>(() => store.get(tokenKey));
  const [state, setState] = useState<GuestState | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState(() => store.get('abg:name') || '');
  const [people, setPeople] = useState(2);
  const [tip, setTip] = useState(0);
  const [msg, setMsg] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [saved, setSaved] = useState<string[]>(() => (store.get('abg:saved') || '').split(',').filter(Boolean));
  const [offline, setOffline] = useState(false);
  const prevStatus = useRef<Record<string, OrderStatus>>({});
  const seenMsgs = useRef<Set<string> | null>(null);
  const [unread, setUnread] = useState(0);

  const T = GUEST_I18N[lang];
  const g = useCallback((k: string, a?: Record<string, unknown>) => fill(GUEST_I18N[lang][k] ?? GUEST_I18N.de[k] ?? k, a), [lang]);
  const flash = (s: string) => { setToast(s); window.setTimeout(() => setToast(null), 3200); };

  // ------------------------------------------------------------ carta
  const loadMenu = useCallback(async () => {
    const { data: r, error } = await supabase.from('restaurants')
      .select('id,slug,name,tagline,address,city,imprint,languages,default_language,theme,plan')
      .eq('slug', slug.toLowerCase()).maybeSingle();
    if (error) { setLoadErr('error'); return; }
    if (!r) { setLoadErr('unknownR'); return; }
    const [c, i, n] = await Promise.all([
      supabase.from('menu_categories').select('id,name,position').eq('restaurant_id', r.id).eq('active', true).order('position'),
      supabase.from('menu_items').select('id,category_id,name,description,price_cents,vat_rate,allergens,vegetarian,vegan,station,photo_url,sold_out,position')
        .eq('restaurant_id', r.id).eq('active', true).order('position'),
      supabase.from('nearby_places').select('id,kind,name,description,distance_m,offer,url').eq('restaurant_id', r.id).eq('active', true).order('position'),
    ]);
    setRestaurant(r as Restaurant);
    setCats((c.data || []) as Category[]);
    setItems((i.data || []) as MenuItem[]);
    setNearby((n.data || []) as NearbyPlace[]);
    setLang((l) => (store.get('abg:lang') ? l : pickLang(r as Restaurant)));
  }, [slug]);

  useEffect(() => { loadMenu(); const id = window.setInterval(loadMenu, 60000); return () => window.clearInterval(id); }, [loadMenu]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { if (restaurant) document.title = restaurant.name; }, [restaurant]);

  // ------------------------------------------------------------ estado de la visita
  const refresh = useCallback(async (): Promise<GuestState | null> => {
    if (!token) { setStateLoaded(true); return null; }
    const { data, error } = await supabase.rpc('guest_state', { p_token: token });
    if (error) { setOffline(true); return null; }
    setOffline(false);
    setStateLoaded(true);
    if (!data) { store.set(tokenKey, null); setToken(null); setState(null); return null; }
    const s = data as GuestState;
    // avisos cuando cambia el estado de un pedido
    for (const o of s.orders) {
      const before = prevStatus.current[o.id];
      if (before && before !== o.status) flash(`${g('order')} #${o.number} ${g(STATUS_KEY[o.status], { w: s.visit.waiter || g('noWaiter') })}`);
      prevStatus.current[o.id] = o.status;
    }
    const staffMsgs = s.messages.filter((m) => m.sender === 'staff');
    if (seenMsgs.current === null) seenMsgs.current = new Set(staffMsgs.map((m) => m.id));
    else {
      const fresh = staffMsgs.filter((m) => !seenMsgs.current!.has(m.id));
      fresh.forEach((m) => seenMsgs.current!.add(m.id));
      if (fresh.length) setUnread((u) => u + fresh.length);
    }
    setState(s);
    return s;
  }, [token, tokenKey, g]);

  useEffect(() => {
    refresh();
    if (!token) return;
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [refresh, token]);

  useEffect(() => { if (screen === 'chat') setUnread(0); }, [screen, state]);

  // ------------------------------------------------------------ acciones
  const errText = (e: unknown) => {
    const k = errKey(e);
    if (k === 'invalid_table') return g('badTable');
    if (k === 'ordering_disabled') return g('noOrdering');
    if (k === 'sold_out') return g('soldoutErr');
    return g('error');
  };

  async function checkIn() {
    if (!table) return;
    setBusy(true);
    store.set('abg:name', name.trim());
    const { data, error } = await supabase.rpc('guest_open', {
      p_slug: slug, p_table: table, p_key: qrKey, p_name: name.trim() || null, p_guests: people, p_lang: lang,
    });
    setBusy(false);
    if (error) { flash(errText(error)); return; }
    const tok = (data as { token: string }).token;
    store.set(tokenKey, tok);
    prevStatus.current = {}; seenMsgs.current = null;
    setToken(tok);
  }

  async function sendOrder() {
    if (!token) return;
    const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([item_id, qty]) => ({ item_id, qty }));
    if (!lines.length) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('guest_place_order', { p_token: token, p_items: lines, p_note: note.trim() || null });
    setBusy(false);
    if (error) {
      flash(errText(error));
      if (errKey(error) === 'sold_out') {
        const id = (error.message.split(':')[1] || '').trim();
        setCart((c) => { const n = { ...c }; delete n[id]; return n; });
        loadMenu();
      }
      return;
    }
    setCart({}); setNote(''); setCartOpen(false);
    const s = await refresh();
    flash(g('t_sent', { no: s?.orders.find((o) => o.id === data)?.number ?? '' }));
  }

  async function sendMessage(phrase?: string) {
    if (!token) return;
    const body = phrase ? null : msg.trim();
    if (!phrase && !body) return;
    const { error } = await supabase.rpc('guest_send_message', { p_token: token, p_body: body, p_phrase_key: phrase || null });
    if (error) { flash(errText(error)); return; }
    if (!phrase) setMsg('');
    refresh();
  }

  async function requestBill() {
    if (!token) return;
    setBusy(true);
    const { error } = await supabase.rpc('guest_request_bill', { p_token: token, p_tip_percent: tip });
    setBusy(false);
    if (error) { flash(errText(error)); return; }
    refresh();
  }

  async function rate(stars: number) {
    if (!token) return;
    await supabase.rpc('guest_rate', { p_token: token, p_stars: stars });
    refresh();
  }

  function newVisit() {
    store.set(tokenKey, null); setToken(null); setState(null); setScreen('menu');
  }

  function changeLang(l: Lang) { store.set('abg:lang', l); setLang(l); }

  function toggleSave(id: string) {
    setSaved((s) => { const n = s.includes(id) ? s.filter((x) => x !== id) : [...s, id]; store.set('abg:saved', n.join(',')); return n; });
  }

  // ------------------------------------------------------------ cálculos
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const cartLines = Object.entries(cart).filter(([id, q]) => q > 0 && itemById[id]);
  const cartCount = cartLines.reduce((a, [, q]) => a + q, 0);
  const cartSum = cartLines.reduce((a, [id, q]) => a + itemById[id].price_cents * q, 0);
  const bill = useMemo(() => {
    const lines: Record<string, { name: string; qty: number; cents: number; vat: number; id: string | null }> = {};
    for (const o of state?.orders || []) {
      if (o.status === 'cancelled') continue;
      for (const l of o.items || []) {
        const k = (l.item_id || l.name) + ':' + l.unit_price_cents;
        lines[k] ??= { name: l.name, qty: 0, cents: 0, vat: l.vat_rate, id: l.item_id };
        lines[k].qty += l.qty; lines[k].cents += l.qty * l.unit_price_cents;
      }
    }
    const arr = Object.values(lines);
    const sum = arr.reduce((a, l) => a + l.cents, 0);
    const vat = (rate: number) => Math.round(arr.filter((l) => Number(l.vat) === rate).reduce((a, l) => a + l.cents, 0) * rate / (100 + rate));
    return { lines: arr, sum, vat7: vat(7), vat19: vat(19) };
  }, [state]);

  // ------------------------------------------------------------ pantalla
  if (loadErr) return <div className="g-root g-center"><p>{g(loadErr)}</p></div>;
  if (!restaurant) return <div className="g-root g-center"><p className="g-muted">{T.loading}</p></div>;

  const r = restaurant;
  const waiter = state?.visit.waiter || g('noWaiter');
  const canOrder = r.plan === 'mesa' && !!table;
  const checkedIn = !!state && state.visit.status !== 'closed';
  const closed = state?.visit.status === 'closed';
  const billRequested = state?.visit.status === 'bill_requested';
  const itemName = (i: MenuItem) => tx(i.name, lang);
  const dishName = (id: string | null, fallback: string) => (id && itemById[id] ? itemName(itemById[id]) : fallback);

  const header = (
    <header className="g-head">
      <div className="g-col g-head-row">
        <div className="g-brand">
          {r.theme.logo_url ? <img className="g-logo-img" src={r.theme.logo_url} alt="" /> : <span className="g-mark">{r.theme.logo_letter || r.name[0]}</span>}
          <div><h1>{r.name}</h1><small>{tx(r.tagline, lang)}</small></div>
        </div>
        <div className="g-head-right">
          <label className="g-lang" title={g('lang')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>
            <b>{lang.toUpperCase()}</b>
            <select value={lang} aria-label={g('lang')} onChange={(e) => changeLang(e.target.value as Lang)}>
              {GUEST_LANGS.filter(([c]) => r.languages.includes(c)).map(([c, l]) => <option key={c} value={c}>{c.toUpperCase()} · {l}</option>)}
            </select>
          </label>
          {table && <div className="g-table"><span>{T.tisch}</span><b>{table}</b></div>}
        </div>
      </div>
    </header>
  );

  const toastEl = toast && <div className="g-toast" role="status">{toast}</div>;
  const offlineEl = offline && <div className="g-offline">{g('offline')}</div>;

  const nearbyEl = (title: string, sub: string) => {
    if (!nearby.length) return null;
    const kinds = Array.from(new Set(nearby.map((n) => n.kind)));
    const list = nearby.filter((n) => kindFilter === 'all' || n.kind === kindFilter);
    return (
      <section className="g-near">
        <h3>{title}</h3><p className="g-muted">{sub}</p>
        {kinds.length > 1 && (
          <div className="g-chips">
            <button className={kindFilter === 'all' ? 'on' : ''} onClick={() => setKindFilter('all')}>{g('f_alle')}</button>
            {kinds.map((k) => <button key={k} className={kindFilter === k ? 'on' : ''} onClick={() => setKindFilter(k)}>{KIND_ICON[k] || '•'}</button>)}
          </div>
        )}
        {list.map((n) => (
          <article key={n.id} className="g-place">
            <span className="g-place-ico" aria-hidden="true">{KIND_ICON[n.kind] || '•'}</span>
            <div>
              <b>{n.name}</b>
              <p>{tx(n.description, lang)}{n.distance_m ? ` · ${n.distance_m} m` : ''}</p>
              {n.offer && <p className="g-offer">{tx(n.offer, lang)}</p>}
            </div>
            <button className="g-save" onClick={() => toggleSave(n.id)}>{saved.includes(n.id) ? g('saved') : g('save')}</button>
          </article>
        ))}
        <p className="g-foot">{g('evFoot')}</p>
      </section>
    );
  };

  // --- gracias (visita cerrada)
  if (closed && state) {
    return (
      <div className="g-root" style={themeVars(r.theme)}>
        {header}
        <main className="g-col g-pad g-thanks">
          <p className="g-eb">{g('checkedout', { n: table })}</p>
          <h2 className="g-h">{g('thanks')}</h2>
          <p className="g-muted">{g('thanksTxt', { name: state.visit.guest_name ? ', ' + state.visit.guest_name : '' })}</p>
          <div className="g-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={g('stars', { n })} className={(state.visit.rating || 0) >= n ? 'on' : ''} onClick={() => rate(n)}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" /></svg>
              </button>
            ))}
          </div>
          {state.visit.rating && <p className="g-muted">{g('rated')}</p>}
          <button className="g-btn ghost" onClick={newVisit}>{g('newvisit')}</button>
          {nearbyEl(g('whereNow'), g('nearRest', { r: r.name }))}
        </main>
        {toastEl}
      </div>
    );
  }

  // --- check-in (solo si se llega con el QR de una mesa)
  const showCheckin = canOrder && stateLoaded && !checkedIn && screen === 'menu' && !!qrKey;

  // --- chat
  const chatEl = state && (
    <main className="g-col g-pad g-chat-wrap">
      <div className="g-chatwho"><span className="g-av">{waiter[0]?.toUpperCase()}</span><div><b>{waiter}</b><span>{g('waiterRole')}</span></div></div>
      <div className="g-chat">
        {state.messages.filter((m) => m.sender !== 'system').map((m) => (
          <div key={m.id} className={`g-bub ${m.sender === 'guest' ? 'me' : 'them'}`}>
            <p>{m.phrase_key ? g(m.phrase_key, m.phrase_args || {}) : (m.sender === 'staff' && m.translation?.[lang]) || m.body}</p>
            {!m.phrase_key && m.sender === 'staff' && m.translation?.[lang] && <small className="g-orig">{m.body}</small>}
            <time>{timeHM(m.created_at)}</time>
          </div>
        ))}
        {!state.messages.some((m) => m.sender !== 'system') && <p className="g-muted g-center-t">{g('chatEmpty', { w: waiter })}</p>}
      </div>
      <div className="g-compose">
        <div className="g-chips">{GUEST_QUICK.map((k) => <button key={k} onClick={() => sendMessage(k)}>{g(k)}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} placeholder={g('msgPh', { w: waiter })} aria-label={g('msg')} />
          <button className="g-btn sm" disabled={!msg.trim()}>{g('send')}</button>
        </form>
      </div>
    </main>
  );

  // --- cuenta
  const billEl = state && (
    <main className="g-col g-pad">
      <p className="g-eb">{g('checkout', { n: table })}</p>
      <h2 className="g-h">{g('bill')}</h2>
      {bill.lines.length ? bill.lines.map((l, i) => (
        <div className="g-line" key={i}><span className="q">{l.qty}×</span><span>{dishName(l.id, l.name)}</span><span className="pr">{eur(l.cents)}</span></div>
      )) : <p className="g-muted">{g('nothing')}</p>}
      {bill.lines.length > 0 && <>
        <div className="g-line sub"><span /><span>{g('subtotal')}</span><span className="pr">{eur(bill.sum)}</span></div>
        {bill.vat7 > 0 && <div className="g-line vat"><span /><span>{g('vat7')}</span><span className="pr">{eur(bill.vat7)}</span></div>}
        {bill.vat19 > 0 && <div className="g-line vat"><span /><span>{g('vat19')}</span><span className="pr">{eur(bill.vat19)}</span></div>}
        {!billRequested && (
          <div className="g-tip"><span>{g('tip')}</span>
            <div className="g-seg">{[0, 5, 10, 15].map((p) => <button key={p} className={tip === p ? 'on' : ''} onClick={() => setTip(p)}>{p ? `${p} %` : '–'}</button>)}</div>
          </div>
        )}
        <div className="g-line total"><span /><span>{g('total')}</span><span className="pr">{eur(bill.sum + Math.round(bill.sum * (billRequested ? state.visit.tip_percent : tip) / 100))}</span></div>
        <p className="g-legal">{g('preview')}</p>
        {billRequested ? (
          <>
            <div className="g-info"><b>{g('comingB', { w: waiter })}</b>{g('comingT')}</div>
            {nearbyEl(g('eveningT'), g('eveningS'))}
            <button className="g-card-btn" onClick={() => setScreen('chat')}><b>{g('askB', { w: waiter })}</b><span>{g('askS')}</span></button>
          </>
        ) : (
          <button className="g-btn" disabled={busy} onClick={requestBill}>{g('billreq')}</button>
        )}
      </>}
    </main>
  );

  // --- carta
  const visibleCats = cats.filter((c) => items.some((i) => i.category_id === c.id));
  const menuEl = (
    <main className="g-col">
      {showCheckin && (
        <section className="g-pad g-checkin">
          <p className="g-eb">{g('scanned')}</p>
          <h2 className="g-h">{g('welcome', { r: r.name })}</h2>
          <p className="g-muted">{g('checkinTxt', { n: table })}</p>
          <label className="g-field">{g('name')}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="given-name" placeholder={g('namePh')} /></label>
          <div className="g-row">{g('people')}
            <div className="g-step">
              <button onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label={g('less')}>−</button><b>{people}</b>
              <button className="p" onClick={() => setPeople((p) => Math.min(20, p + 1))} aria-label={g('more')}>+</button>
            </div>
          </div>
          <button className="g-btn" disabled={busy} onClick={checkIn}>{g('checkin')}</button>
          <p className="g-legal"><b>{g('paperB')}</b> {g('paperT', { w: g('noWaiter') })}</p>
        </section>
      )}
      {canOrder && !qrKey && !checkedIn && stateLoaded && <div className="g-info g-pad-x">{g('badTable')}</div>}
      {!canOrder && table && r.plan !== 'mesa' && <div className="g-info g-pad-x">{g('noOrdering')}</div>}
      {checkedIn && state && state.orders.length > 0 && (
        <section className="g-pad-x g-status">
          {state.orders.filter((o) => o.status !== 'served' && o.status !== 'cancelled').map((o) => (
            <div key={o.id} className={`g-st s-${o.status}`}><b>{g('order')} #{o.number}</b> {g(STATUS_KEY[o.status], { w: waiter })}</div>
          ))}
        </section>
      )}
      <nav className="g-cats" aria-label="Kategorien">
        {visibleCats.map((c) => (
          <a key={c.id} href={`#c-${c.id}`} className={activeCat === c.id ? 'on' : ''} onClick={() => setActiveCat(c.id)}>{tx(c.name, lang)}</a>
        ))}
      </nav>
      {visibleCats.map((c) => (
        <section key={c.id} id={`c-${c.id}`} className="g-sec">
          <h2>{tx(c.name, lang)}</h2>
          {items.filter((i) => i.category_id === c.id).map((i) => {
            const q = cart[i.id] || 0;
            return (
              <article key={i.id} className={`g-item ${i.sold_out ? 'out' : ''}`}>
                {i.photo_url && <img className="g-ph" src={i.photo_url} alt="" loading="lazy" />}
                <div className="g-item-body">
                  <h3>{itemName(i)}</h3>
                  <p>{tx(i.description, lang)}</p>
                  <div className="g-tags">
                    {i.vegetarian && <span className="veg" title="vegetarisch">{i.vegan ? 'vegan' : 'veg'}</span>}
                    {i.allergens.length > 0 && <span className="al" title={g('allergens')}>{i.allergens.join(', ')}</span>}
                  </div>
                  <div className="g-item-foot">
                    <b>{eur(i.price_cents)}</b>
                    {i.sold_out ? <span className="g-out">{g('soldout')}</span> : checkedIn && !billRequested && (
                      q ? (
                        <div className="g-step">
                          <button onClick={() => setCart((c) => ({ ...c, [i.id]: q - 1 }))} aria-label={g('less')}>−</button><b>{q}</b>
                          <button className="p" onClick={() => setCart((c) => ({ ...c, [i.id]: q + 1 }))} aria-label={g('more')}>+</button>
                        </div>
                      ) : <button className="g-add" aria-label={g('add', { n: itemName(i) })} onClick={() => setCart((c) => ({ ...c, [i.id]: 1 }))}>+</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}
      <p className="g-legal g-pad-x">{g('allerg')}</p>
      <p className="g-legal g-pad-x">{g('privacy', { imp: r.imprint || r.name })}</p>
      <p className="g-sig">{g('sig')} <b>abWeb</b> solutions</p>
    </main>
  );

  return (
    <div className={`g-root ${checkedIn ? 'has-nav' : ''}`} style={themeVars(r.theme)}>
      {header}
      {offlineEl}
      {screen === 'menu' && menuEl}
      {screen === 'chat' && chatEl}
      {screen === 'bill' && billEl}

      {screen === 'menu' && cartCount > 0 && !cartOpen && (
        <button className="g-cartbar" onClick={() => setCartOpen(true)}>
          <span className="n">{cartCount}</span><span>{g('viewOrder')}</span><b>{eur(cartSum)}</b>
        </button>
      )}
      {cartOpen && (
        <div className="g-sheet-bg" onClick={() => setCartOpen(false)}>
          <div className="g-sheet" role="dialog" aria-label={g('yourOrder')} onClick={(e) => e.stopPropagation()}>
            <h2 className="g-h sm">{g('yourOrder')}</h2>
            <p className="g-muted">{g('goesTo', { n: table, w: waiter })}</p>
            {cartLines.length ? cartLines.map(([id, q]) => (
              <div className="g-line" key={id}>
                <span className="q">{q}×</span><span>{itemName(itemById[id])}</span>
                <div className="g-step sm">
                  <button onClick={() => setCart((c) => ({ ...c, [id]: q - 1 }))} aria-label={g('less')}>−</button>
                  <button className="p" onClick={() => setCart((c) => ({ ...c, [id]: q + 1 }))} aria-label={g('more')}>+</button>
                </div>
                <span className="pr">{eur(itemById[id].price_cents * q)}</span>
              </div>
            )) : <p className="g-muted">{g('noneSel')}</p>}
            <label className="g-field">{g('noteL')}<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder={g('notePh')} /></label>
            <div className="g-line total"><span /><span>{g('sum')}</span><span className="pr">{eur(cartSum)}</span></div>
            <button className="g-btn" disabled={busy || !cartLines.length} onClick={sendOrder}>{g('sendOrder')}</button>
          </div>
        </div>
      )}

      {checkedIn && (
        <nav className="g-nav" aria-label="Navigation">
          {(['menu', 'chat', 'bill'] as Screen[]).map((s) => (
            <button key={s} className={screen === s ? 'on' : ''} onClick={() => setScreen(s)}>
              <span aria-hidden="true">{s === 'menu' ? '☰' : s === 'chat' ? '💬' : '🧾'}</span>
              {g(`nav_${s}`)}
              {s === 'chat' && unread > 0 && screen !== 'chat' && <i className="dot">{unread}</i>}
            </button>
          ))}
        </nav>
      )}
      {toastEl}
    </div>
  );
}

const KIND_ICON: Record<string, string> = { bar: '🍸', music: '🎷', culture: '🎭', market: '🧺', cinema: '🎬', other: '📍' };
