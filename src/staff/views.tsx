import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { GUEST_I18N } from '../i18n/guest';
import type { Message, Order, OrderStatus, TableRow, Visit } from '../lib/types';
import { eur, fill, minutesSince, timeHM, tx } from '../lib/util';
import type { useService } from './useService';

type Svc = ReturnType<typeof useService>;

const ST: Record<OrderStatus, string> = { new: 'Neu', accepted: 'In der Küche', ready: 'Fertig', served: 'Serviert', cancelled: 'Storniert' };
const LANG_DE: Record<string, string> = { de: 'Deutsch', en: 'Englisch', es: 'Spanisch', it: 'Italienisch', fr: 'Französisch', tr: 'Türkisch' };
const WAITER_QUICK = ['w_coming', 'w_onway', 'w_bring', 'w_gf'];
const SYS: Record<string, string> = {
  sys_checkin: '{name} hat eingecheckt ({guests} Pers.)',
  sys_bill: 'Rechnung angefordert (Trinkgeld {tip} %)',
  sys_closed: 'Bezahlt, Tisch freigegeben',
};

/** Texto en alemán de un mensaje (frases rápidas y de sistema por clave). */
function msgDe(m: Message) {
  if (m.phrase_key) {
    const args = { ...(m.phrase_args || {}) } as Record<string, unknown>;
    if (m.phrase_key === 'sys_checkin' && !args.name) args.name = 'Gast';
    return fill(SYS[m.phrase_key] || GUEST_I18N.de[m.phrase_key] || m.phrase_key, args);
  }
  return m.body || '';
}

async function call(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args);
  if (error) alertError(error.message);
  return !error;
}
function alertError(m: string) {
  const txt = m.startsWith('sold_out') ? 'Ein Gericht ist ausverkauft.' : m === 'forbidden' ? 'Keine Berechtigung.' : `Fehler: ${m}`;
  window.alert(txt);
}

function orderTotal(svc: Svc, visitId: string) {
  const oids = new Set(svc.data.orders.filter((o) => o.visit_id === visitId && o.status !== 'cancelled').map((o) => o.id));
  return svc.data.items.filter((i) => oids.has(i.order_id)).reduce((a, i) => a + i.qty * i.unit_price_cents, 0);
}

// ================================================================ Tische
export function Tables({ svc }: { svc: Svc }) {
  const { tableId } = useParams();
  const nav = useNavigate();
  const { tables, visits, orders, messages } = svc.data;
  const visitOf = (t: TableRow) => visits.find((v) => v.table_id === t.id);
  const selected = tables.find((t) => t.id === tableId);

  return (
    <div className={`s-split ${selected ? 'has-detail' : ''}`}>
      <section className="s-grid">
        {tables.map((t) => {
          const v = visitOf(t);
          const newO = v ? orders.filter((o) => o.visit_id === v.id && o.status === 'new').length : 0;
          const ready = v ? orders.filter((o) => o.visit_id === v.id && o.status === 'ready').length : 0;
          const unread = v ? messages.filter((m) => m.visit_id === v.id && m.sender === 'guest' && !m.read_by_staff).length : 0;
          const state = !v ? 'free' : v.status === 'bill_requested' ? 'bill' : newO ? 'new' : 'busy';
          return (
            <button key={t.id} className={`s-table st-${state} ${t.id === tableId ? 'sel' : ''}`} onClick={() => nav(`/app/tische/${t.id}`)}>
              <span className="n">{t.number}</span>
              <span className="l">
                {!v ? `Frei · ${t.seats} Plätze` : v.status === 'bill_requested' ? 'Rechnung!' : `${v.guest_name || 'Gäste'} · ${v.guests} P.`}
              </span>
              {v && <span className="t">seit {timeHM(v.created_at)} · {eur(orderTotal(svc, v.id))}</span>}
              <span className="badges">
                {newO > 0 && <i className="b-new">{newO} neu</i>}
                {ready > 0 && <i className="b-ready">{ready} fertig</i>}
                {unread > 0 && <i className="b-msg">💬 {unread}</i>}
              </span>
            </button>
          );
        })}
      </section>
      {selected && <TableDetail key={selected.id} svc={svc} table={selected} visit={visitOf(selected)} onClose={() => nav('/app/tische')} />}
    </div>
  );
}

function TableDetail({ svc, table, visit, onClose }: { svc: Svc; table: TableRow; visit?: Visit; onClose: () => void }) {
  const [pad, setPad] = useState(false);
  const [text, setText] = useState('');
  const msgs = visit ? svc.data.messages.filter((m) => m.visit_id === visit.id) : [];
  const orders = visit ? svc.data.orders.filter((o) => o.visit_id === visit.id) : [];
  const unread = msgs.some((m) => m.sender === 'guest' && !m.read_by_staff);

  useEffect(() => { if (visit && unread) call('staff_mark_read', { p_visit: visit.id }); }, [visit, unread]);

  async function send(phrase?: string) {
    if (!visit) return;
    if (!phrase && !text.trim()) return;
    if (await call('staff_send_message', { p_visit: visit.id, p_body: phrase ? null : text.trim(), p_phrase_key: phrase || null })) {
      if (!phrase) setText('');
      svc.reload();
    }
  }
  async function close() {
    if (!visit) return;
    if (!window.confirm(`Tisch ${table.number} bezahlt und freigeben?`)) return;
    if (await call('staff_close_visit', { p_visit: visit.id })) { svc.reload(); onClose(); }
  }
  const total = visit ? orderTotal(svc, visit.id) : 0;
  const tipCents = visit ? Math.round(total * visit.tip_percent / 100) : 0;

  return (
    <aside className="s-detail">
      <div className="s-detail-head">
        <button className="s-back" onClick={onClose} aria-label="Zurück">←</button>
        <div><h2>Tisch {table.number}</h2>
          {visit ? <small>{visit.guest_name || 'Gäste'} · {visit.guests} Pers. · seit {timeHM(visit.created_at)} · {visit.opened_by === 'guest' ? 'per QR' : 'vom Service'}{visit.language !== 'de' ? ` · spricht ${LANG_DE[visit.language] || visit.language}` : ''}</small> : <small>Frei</small>}
        </div>
      </div>

      {pad ? <OrderPad svc={svc} table={table} visit={visit} onDone={() => setPad(false)} /> : <>
        <button className="s-btn primary wide" onClick={() => setPad(true)}>＋ Bestellung aufnehmen</button>

        {orders.length > 0 && <h3>Bestellungen</h3>}
        {orders.map((o) => <OrderCard key={o.id} svc={svc} order={o} compact />)}

        {visit && <>
          <h3>Chat mit dem Gast{visit.language !== 'de' && <small> (Schnellantworten werden übersetzt)</small>}</h3>
          <div className="s-chat">
            {msgs.map((m) => (
              <div key={m.id} className={`s-bub ${m.sender}`}>
                <p>{msgDe(m)}</p><time>{timeHM(m.created_at)}</time>
              </div>
            ))}
          </div>
          {(visit.opened_by === 'guest' || msgs.some((m) => m.sender === 'guest')) && <>
            <div className="s-chips">{WAITER_QUICK.map((k) => <button key={k} onClick={() => send(k)}>{GUEST_I18N.de[k]}</button>)}</div>
            <form className="s-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Nachricht an den Gast" />
              <button className="s-btn primary" disabled={!text.trim()}>Senden</button>
            </form>
          </>}

          <div className="s-bill">
            <div><span>Summe</span><b>{eur(total)}</b></div>
            {tipCents > 0 && <div><span>Trinkgeld ({visit.tip_percent} %)</span><b>{eur(tipCents)}</b></div>}
            <p>Abrechnung über Ihre Kasse. Diese App erstellt keine Belege.</p>
            <button className={`s-btn wide ${visit.status === 'bill_requested' ? 'primary' : ''}`} onClick={close}>Bezahlt · Tisch freigeben</button>
          </div>
        </>}
      </>}
    </aside>
  );
}

function OrderCard({ svc, order, compact, kitchen }: { svc: Svc; order: Order; compact?: boolean; kitchen?: boolean }) {
  const table = svc.data.tables.find((t) => t.id === order.table_id);
  const lines = svc.data.items.filter((i) => i.order_id === order.id && (!kitchen || i.station === 'kitchen'));
  const hasKitchen = svc.data.items.some((i) => i.order_id === order.id && i.station === 'kitchen');
  const set = async (s: OrderStatus) => { if (await call('staff_set_order_status', { p_order: order.id, p_status: s })) svc.reload(); };
  const since = minutesSince(order.accepted_at || order.created_at);
  return (
    <article className={`s-order os-${order.status} ${kitchen && since >= 15 ? 'late' : ''}`}>
      <header>
        <b>#{order.number} · Tisch {table?.number}</b>
        <span>{order.source === 'guest' ? 'QR' : 'Service'} · {timeHM(order.created_at)}{kitchen ? ` · ${since} min` : ''}</span>
        {!kitchen && <em>{ST[order.status]}</em>}
      </header>
      <ul>
        {lines.map((l) => (
          <li key={l.id}><b>{l.qty}×</b> {l.name}{!kitchen && l.station === 'bar' && <span className="bar">Bar</span>}{l.note && <small>{l.note}</small>}</li>
        ))}
      </ul>
      {order.note && <p className="note">„{order.note}“</p>}
      <footer>
        {kitchen ? <button className="s-btn primary wide big" onClick={() => set('ready')}>Fertig ✓</button> : <>
          {order.status === 'new' && <button className="s-btn primary" onClick={() => set(hasKitchen ? 'accepted' : 'ready')}>{hasKitchen ? 'Bestätigen → Küche' : 'Bestätigen'}</button>}
          {order.status === 'accepted' && !hasKitchen && <button className="s-btn primary" onClick={() => set('served')}>Serviert</button>}
          {order.status === 'ready' && <button className="s-btn primary" onClick={() => set('served')}>Serviert</button>}
          {!compact && order.status === 'accepted' && hasKitchen && <span className="wait">Küche bereitet zu…</span>}
          {(order.status === 'new' || order.status === 'accepted') && <button className="s-btn ghost" onClick={() => window.confirm(`Bestellung #${order.number} stornieren?`) && set('cancelled')}>Stornieren</button>}
        </>}
      </footer>
    </article>
  );
}

/** El camarero apunta un pedido (cliente con carta de papel). */
function OrderPad({ svc, table, visit, onDone }: { svc: Svc; table: TableRow; visit?: Visit; onDone: () => void }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState<string>(svc.data.cats[0]?.id || '');
  const items = svc.data.menu;
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const sum = lines.reduce((a, [id, q]) => a + (items.find((i) => i.id === id)?.price_cents || 0) * q, 0);

  async function submit() {
    setBusy(true);
    let vid = visit?.id;
    if (!vid) {
      const { data, error } = await supabase.rpc('staff_open_visit', { p_table: table.id, p_guests: guests });
      if (error) { setBusy(false); alertError(error.message); return; }
      vid = data as string;
    }
    const { error } = await supabase.rpc('staff_place_order', { p_visit: vid, p_items: lines.map(([item_id, qty]) => ({ item_id, qty })), p_note: note.trim() || null });
    setBusy(false);
    if (error) { alertError(error.message); return; }
    svc.reload(); onDone();
  }

  return (
    <div className="s-pad">
      <div className="s-pad-head"><h3>Bestellung für Tisch {table.number}</h3><button className="s-btn ghost sm" onClick={onDone}>Abbrechen</button></div>
      {!visit && <label className="s-inline">Personen <input type="number" min={1} max={30} value={guests} onChange={(e) => setGuests(+e.target.value || 1)} /></label>}
      <div className="s-chips">{svc.data.cats.map((c) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{tx(c.name, 'de')}</button>)}</div>
      <div className="s-pad-list">
        {items.filter((i) => i.category_id === cat).map((i) => {
          const q = cart[i.id] || 0;
          return (
            <div key={i.id} className={`s-pad-item ${i.sold_out ? 'out' : ''}`}>
              <span>{tx(i.name, 'de')}<small>{eur(i.price_cents)}{i.sold_out ? ' · aus' : ''}</small></span>
              <div className="s-step">
                {q > 0 && <><button onClick={() => setCart((c) => ({ ...c, [i.id]: q - 1 }))}>−</button><b>{q}</b></>}
                <button className="p" disabled={i.sold_out} onClick={() => setCart((c) => ({ ...c, [i.id]: q + 1 }))}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      <input className="s-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Hinweis für die Küche (optional)" />
      <button className="s-btn primary wide" disabled={busy || !lines.length} onClick={submit}>
        {lines.length ? `${lines.reduce((a, [, q]) => a + q, 0)} Positionen senden · ${eur(sum)}` : 'Gerichte wählen'}
      </button>
    </div>
  );
}

// ================================================================ Bestellungen
export function Orders({ svc }: { svc: Svc }) {
  const o = svc.data.orders;
  const cols: [string, Order[]][] = [
    ['Neu', o.filter((x) => x.status === 'new')],
    ['Fertig zum Servieren', o.filter((x) => x.status === 'ready')],
    ['In Arbeit', o.filter((x) => x.status === 'accepted')],
  ];
  return (
    <div className="s-cols">
      {cols.map(([title, list]) => (
        <section key={title}>
          <h2>{title} <span>{list.length}</span></h2>
          {list.length ? list.map((x) => <OrderCard key={x.id} svc={svc} order={x} />) : <p className="s-empty">Nichts offen.</p>}
        </section>
      ))}
    </div>
  );
}

// ================================================================ Küche
export function Kitchen({ svc }: { svc: Svc }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((x) => x + 1), 30000); return () => window.clearInterval(id); }, []);
  const list = svc.data.orders
    .filter((o) => o.status === 'accepted' && svc.data.items.some((i) => i.order_id === o.id && i.station === 'kitchen'))
    .sort((a, b) => (a.accepted_at || a.created_at).localeCompare(b.accepted_at || b.created_at));
  return (
    <div className="s-kds">
      {list.length ? list.map((o) => <OrderCard key={o.id} svc={svc} order={o} kitchen />) : <p className="s-empty big">Keine offenen Bestellungen. 👨‍🍳</p>}
    </div>
  );
}

// ================================================================ Karte (ausverkauft)
export function MenuToggles({ svc }: { svc: Svc }) {
  return (
    <div className="s-menu">
      <p className="s-hint">Tippen Sie auf ein Gericht, um es für heute als <b>ausverkauft</b> zu markieren. Gäste sehen es sofort.</p>
      {svc.data.cats.map((c) => (
        <section key={c.id}>
          <h3>{tx(c.name, 'de')}</h3>
          {svc.data.menu.filter((i) => i.category_id === c.id).map((i) => (
            <button key={i.id} className={`s-toggle ${i.sold_out ? 'off' : ''}`}
              onClick={async () => { if (await call('staff_set_sold_out', { p_item: i.id, p_sold_out: !i.sold_out })) svc.reload(); }}>
              <span>{tx(i.name, 'de')}</span><em>{i.sold_out ? 'Ausverkauft' : 'Verfügbar'}</em>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

// ================================================================ QR-Codes
export function QrCodes({ svc }: { svc: Svc }) {
  const slug = svc.data.restaurant?.slug;
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const links = useMemo(() => Object.fromEntries(svc.data.tables.map((t) => [t.id, `${window.location.origin}/r/${slug}/mesa/${t.number}?k=${t.qr_key}`])), [svc.data.tables, slug]);
  useEffect(() => {
    if (!slug) return;
    Promise.all(Object.entries(links).map(async ([id, url]) => [id, await QRCode.toDataURL(url, { margin: 1, width: 360 })] as const))
      .then((r) => setImgs(Object.fromEntries(r)));
  }, [links, slug]);
  return (
    <div className="s-qr">
      <div className="s-qr-head no-print">
        <p className="s-hint">Jeder Tisch hat einen eigenen Code mit geheimem Schlüssel. So kann niemand von außerhalb „an Tisch 7“ bestellen. Drucken, ausschneiden und auf die Tische stellen.</p>
        <button className="s-btn primary" onClick={() => window.print()}>Drucken</button>
      </div>
      <div className="s-qr-grid">
        {svc.data.tables.map((t) => (
          <figure key={t.id} className="s-qr-card">
            <figcaption><b>{svc.data.restaurant?.name}</b><span>Tisch {t.number}</span></figcaption>
            {imgs[t.id] ? <img src={imgs[t.id]} alt={`QR-Code Tisch ${t.number}`} /> : <div className="ph" />}
            <small>Scannen · Speisekarte · Bestellen</small>
            <a className="no-print" href={links[t.id]} target="_blank" rel="noreferrer">Link öffnen</a>
          </figure>
        ))}
      </div>
    </div>
  );
}
