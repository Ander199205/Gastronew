import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { staffAdmin } from '../../lib/staffAdmin';
import { guestUrl } from '../../lib/util';
import { Credentials } from '../manage/TeamEditor';
import { useSaver } from '../manage/common';
import '../../styles/manage.css';

interface R {
  id: string; slug: string; name: string; city: string | null; plan: 'carta' | 'mesa'; active: boolean; created_at: string;
  staff: number; tables: number; items: number; visits_30d: number; orders_30d: number; last_activity: string | null;
}
const PRICE = { carta: 29, mesa: 79 };
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('de-DE') : '–');

/** Panel de abWeb: todos los restaurantes, altas nuevas, plan y estado. */
export default function AdminPanel({ onOpen }: { onOpen: (rid: string) => void }) {
  const [rows, setRows] = useState<R[] | null>(null);
  const [v, setV] = useState(0);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ name: '', slug: '', city: 'Heilbronn', plan: 'mesa' as 'carta' | 'mesa', tables: 10, owner_name: '', owner_email: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [cred, setCred] = useState<{ email: string; password: string | null } | null>(null);
  const { run, badge, saving } = useSaver();

  useEffect(() => { supabase.rpc('admin_overview').then(({ data }) => setRows((data || []) as R[])); }, [v]);
  const reload = () => setV((x) => x + 1);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    let res: { email?: string; password?: string | null; restaurant_id?: string } = {};
    if (await run(async () => { res = await staffAdmin('create_restaurant', f); })) {
      setCred({ email: res.email || f.owner_email, password: res.password ?? null });
      setShow(false); setSlugTouched(false);
      setF({ ...f, name: '', slug: '', owner_name: '', owner_email: '' });
      reload();
    }
  }
  async function patch(r: R, p: Partial<R>) {
    if (await run(async () => supabase.from('restaurants').update(p).eq('id', r.id))) reload();
  }

  const live = (rows || []).filter((r) => r.active);
  const mrr = live.reduce((s, r) => s + PRICE[r.plan], 0);

  return (
    <div className="m-wrap">
      <div className="m-bar">
        <div><h2 style={{ margin: 0 }}>abWeb Admin</h2>{badge}</div>
        <div><button className="s-btn primary" onClick={() => setShow(true)}>Neues Restaurant</button></div>
      </div>
      <div className="a-kpis">
        <div><b>{live.length}</b><span>aktive Restaurants</span></div>
        <div><b>{mrr} €</b><span>Monatsumsatz (Liste)</span></div>
        <div><b>{live.reduce((s, r) => s + r.orders_30d, 0)}</b><span>Bestellungen, 30 Tage</span></div>
      </div>
      {!rows && <p className="m-hint">Lädt…</p>}
      <div className="a-list">
        {(rows || []).map((r) => (
          <div key={r.id} className={`m-cat a-card ${r.active ? '' : 'hidden'}`}>
            <header>
              <div><h3>{r.name}</h3><small className="m-hint">/{r.slug} · {r.city || '–'} · seit {day(r.created_at)}</small></div>
              <div className="m-actions">
                <button onClick={() => onOpen(r.id)}>Öffnen</button>
                <a className="s-btn sm" href={guestUrl(`/r/${r.slug}`)} target="_blank" rel="noreferrer">Speisekarte</a>
              </div>
            </header>
            <div className="a-stats">
              <span>{r.tables} Tische</span><span>{r.items} Gerichte</span><span>{r.staff} Personen</span>
              <span>{r.visits_30d} Besuche / {r.orders_30d} Bestellungen (30 T.)</span><span>zuletzt aktiv {day(r.last_activity)}</span>
            </div>
            <div className="a-ctl">
              <select className="s-select" value={r.plan} onChange={(e) => patch(r, { plan: e.target.value as R['plan'] })} aria-label="Plan">
                <option value="carta">Carta · 29 €</option><option value="mesa">Mesa · 79 €</option>
              </select>
              <button className={`s-btn sm ${r.active ? 'danger' : ''}`} onClick={() => {
                if (!r.active || window.confirm(`${r.name} deaktivieren? Die Speisekarte ist dann für Gäste nicht mehr erreichbar.`)) patch(r, { active: !r.active });
              }}>{r.active ? 'Deaktivieren' : 'Aktivieren'}</button>
            </div>
          </div>
        ))}
      </div>

      {show && (
        <div className="m-modal-bg" onClick={() => setShow(false)}>
          <form className="m-modal" onClick={(e) => e.stopPropagation()} onSubmit={create}>
            <h2>Neues Restaurant</h2>
            <label className="m-field">Name<input value={f.name} required onChange={(e) => setF({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) })} /></label>
            <label className="m-field">Adresse der Speisekarte
              <input value={f.slug} required pattern="[a-z0-9][a-z0-9\-]{1,40}" onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value.toLowerCase() }); }} />
              <small className="m-hint">{guestUrl(`/r/${f.slug || '…'}`)}</small>
            </label>
            <div className="m-grid3">
              <label className="m-field">Stadt<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
              <label className="m-field">Plan<select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as 'carta' | 'mesa' })}><option value="carta">Carta · 29 €</option><option value="mesa">Mesa · 79 €</option></select></label>
              <label className="m-field">Tische<input type="number" min={0} max={80} value={f.tables} onChange={(e) => setF({ ...f, tables: Number(e.target.value) })} /></label>
            </div>
            <h3 style={{ margin: '14px 0 0' }}>Inhaber-Zugang</h3>
            <div className="m-grid3">
              <label className="m-field">Name<input value={f.owner_name} required onChange={(e) => setF({ ...f, owner_name: e.target.value })} /></label>
              <label className="m-field">E-Mail<input type="email" value={f.owner_email} required onChange={(e) => setF({ ...f, owner_email: e.target.value })} /></label>
            </div>
            <div className="m-foot"><button type="button" className="s-btn" onClick={() => setShow(false)}>Abbrechen</button><span />{badge}<button className="s-btn primary" disabled={saving}>Anlegen</button></div>
          </form>
        </div>
      )}
      {cred && <Credentials {...cred} title="Restaurant angelegt" onClose={() => setCred(null)} />}
    </div>
  );
}
