import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { I18nText, NearbyPlace, Staff, TableRow } from '../../lib/types';
import { tx } from '../../lib/util';
import { I18nInput, useSaver } from './common';

type T = TableRow & { active: boolean };

export function TablesEditor({ rid, onSaved }: { rid: string; onSaved: () => void }) {
  const [tables, setTables] = useState<T[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const saver = useSaver();
  const load = useCallback(async () => {
    const [t, s] = await Promise.all([
      supabase.from('tables').select('*').eq('restaurant_id', rid).order('number'),
      supabase.from('staff').select('id,restaurant_id,display_name,role').eq('restaurant_id', rid).eq('active', true),
    ]);
    setTables((t.data || []) as T[]); setStaff((s.data || []) as Staff[]);
  }, [rid]);
  useEffect(() => { load(); }, [load]);
  const after = async (ok: boolean) => { if (ok) { await load(); onSaved(); } };

  const waiters = staff.filter((s) => s.role !== 'kitchen');
  const add = () => after2(supabase.from('tables').insert({ restaurant_id: rid, number: (tables.at(-1)?.number || 0) + 1, seats: 4, waiter_id: waiters[0]?.id || null }));
  const after2 = async (p: PromiseLike<{ error: { message: string } | null }>) => after(await saver.run(() => p as never));
  const update = (id: string, patch: Partial<T>) => after2(supabase.from('tables').update(patch).eq('id', id));
  const newKey = (t: T) => {
    if (!window.confirm(`Neuen QR-Schlüssel für Tisch ${t.number}? Der alte QR-Code funktioniert danach nicht mehr und muss neu gedruckt werden.`)) return;
    const key = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, '0')).join('');
    update(t.id, { qr_key: key });
  };

  return (
    <div className="m-wrap">
      <div className="m-bar">
        <p className="s-hint">Tische, Plätze und zuständige Bedienung. QR-Codes drucken Sie unter „QR-Codes“.</p>
        <div>{saver.badge}<button className="s-btn primary" onClick={add}>＋ Tisch</button></div>
      </div>
      <table className="m-table">
        <thead><tr><th>Tisch</th><th>Plätze</th><th>Bedienung</th><th>Aktiv</th><th /></tr></thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.id} className={t.active ? '' : 'hidden'}>
              <td><b>{t.number}</b></td>
              <td><input type="number" min={1} max={30} defaultValue={t.seats} onBlur={(e) => +e.target.value !== t.seats && update(t.id, { seats: +e.target.value || 1 })} /></td>
              <td><select value={t.waiter_id || ''} onChange={(e) => update(t.id, { waiter_id: e.target.value || null })}>
                <option value="">–</option>{waiters.map((w) => <option key={w.id} value={w.id}>{w.display_name}</option>)}
              </select></td>
              <td><input type="checkbox" checked={t.active} onChange={(e) => update(t.id, { active: e.target.checked })} /></td>
              <td><button className="s-btn ghost sm" onClick={() => newKey(t)}>Neuer QR-Schlüssel</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KINDS: [string, string][] = [['bar', 'Bar'], ['music', 'Musik'], ['culture', 'Kultur'], ['market', 'Markt'], ['cinema', 'Kino'], ['other', 'Sonstiges']];
type P = NearbyPlace & { position: number; active: boolean };

export function NearbyEditor({ rid, languages }: { rid: string; languages: string[] }) {
  const [list, setList] = useState<P[]>([]);
  const [edit, setEdit] = useState<Partial<P> & { name: string; description: I18nText; kind: string } | null>(null);
  const saver = useSaver();
  const load = useCallback(async () => {
    const { data } = await supabase.from('nearby_places').select('*').eq('restaurant_id', rid).order('position');
    setList((data || []) as P[]);
  }, [rid]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!edit || !edit.name.trim()) return;
    const row = { restaurant_id: rid, kind: edit.kind, name: edit.name.trim(), description: edit.description, distance_m: edit.distance_m || null,
      offer: edit.offer && Object.keys(edit.offer).length ? edit.offer : null, url: edit.url || null, active: edit.active ?? true, position: edit.position ?? list.length };
    const ok = await saver.run(() => (edit.id ? supabase.from('nearby_places').update(row).eq('id', edit.id) : supabase.from('nearby_places').insert(row)) as never);
    if (ok) { setEdit(null); load(); }
  }
  async function remove() {
    if (!edit?.id || !window.confirm(`„${edit.name}“ löschen?`)) return;
    if (await saver.run(() => supabase.from('nearby_places').delete().eq('id', edit.id!) as never)) { setEdit(null); load(); }
  }

  return (
    <div className="m-wrap">
      <div className="m-bar">
        <p className="s-hint">Tipps, die Gäste sehen, wenn sie die Rechnung anfordern: Bars, Konzerte, Kino… Mit Partner-Angebot möglich.</p>
        <div>{saver.badge}<button className="s-btn primary" onClick={() => setEdit({ kind: 'bar', name: '', description: {} })}>＋ Tipp</button></div>
      </div>
      {list.map((p) => (
        <div key={p.id} className={`m-row ${p.active ? '' : 'hidden'}`}>
          <button className="m-row-main" onClick={() => setEdit(p)}>
            <b>{p.name}</b><small>{KINDS.find((k) => k[0] === p.kind)?.[1]} · {tx(p.description, 'de')}{p.distance_m ? ` · ${p.distance_m} m` : ''}{p.offer ? ' · mit Angebot' : ''}</small>
          </button>
        </div>
      ))}
      {!list.length && <p className="s-empty">Noch keine Tipps.</p>}
      {edit && (
        <div className="m-modal-bg" onClick={() => setEdit(null)}>
          <div className="m-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{edit.id ? 'Tipp bearbeiten' : 'Neuer Tipp'}</h2>
            <label className="m-field">Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <div className="m-grid3">
              <label className="m-field">Art<select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label className="m-field">Entfernung (m)<input type="number" min={0} value={edit.distance_m ?? ''} onChange={(e) => setEdit({ ...edit, distance_m: e.target.value ? +e.target.value : null })} /></label>
              <label className="m-field">Aktiv<select value={edit.active === false ? '0' : '1'} onChange={(e) => setEdit({ ...edit, active: e.target.value === '1' })}><option value="1">ja</option><option value="0">nein</option></select></label>
            </div>
            <I18nInput label="Beschreibung (z. B. Live-Jazz ab 21 Uhr)" value={edit.description} languages={languages} onChange={(description) => setEdit({ ...edit, description })} />
            <I18nInput label="Partner-Angebot (optional)" value={edit.offer || {}} languages={languages} onChange={(offer) => setEdit({ ...edit, offer })} />
            <div className="m-foot">
              {edit.id && <button className="s-btn ghost danger" onClick={remove}>Löschen</button>}
              <span>{saver.badge}</span>
              <button className="s-btn" onClick={() => setEdit(null)}>Abbrechen</button>
              <button className="s-btn primary" onClick={save}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
