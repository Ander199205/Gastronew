import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Category, I18nText, MenuItem } from '../../lib/types';
import { eur, tx } from '../../lib/util';
import { ALLERGENS, I18nInput, centsToEuro, euroToCents, uploadImage, useSaver } from './common';

type Item = MenuItem & { active: boolean };
type Draft = Omit<Item, 'id'> & { id?: string };
const blank = (category_id: string, position: number): Draft => ({
  category_id, name: {}, description: {}, price_cents: 0, vat_rate: 7, allergens: [], vegetarian: false, vegan: false,
  station: 'kitchen', photo_url: null, sold_out: false, position, active: true,
});

export default function MenuEditor({ rid, languages }: { rid: string; languages: string[] }) {
  const [cats, setCats] = useState<(Category & { active: boolean })[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [catEdit, setCatEdit] = useState<{ id?: string; name: I18nText } | null>(null);
  const saver = useSaver();

  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      supabase.from('menu_categories').select('id,name,position,active').eq('restaurant_id', rid).order('position'),
      supabase.from('menu_items').select('*').eq('restaurant_id', rid).order('position'),
    ]);
    setCats((c.data || []) as (Category & { active: boolean })[]);
    setItems((i.data || []) as Item[]);
  }, [rid]);
  useEffect(() => { load(); }, [load]);

  async function saveItem() {
    if (!edit) return;
    if (!edit.name.de?.trim()) { window.alert('Bitte einen deutschen Namen eingeben.'); return; }
    const { id, ...row } = edit;
    const clean = {
      restaurant_id: rid, category_id: row.category_id, name: row.name, description: row.description, price_cents: row.price_cents,
      vat_rate: row.vat_rate, allergens: row.allergens, vegetarian: row.vegetarian, vegan: row.vegan, station: row.station,
      photo_url: row.photo_url, sold_out: row.sold_out, position: row.position, active: row.active,
    };
    const ok = await saver.run(() => (id ? supabase.from('menu_items').update(clean).eq('id', id) : supabase.from('menu_items').insert(clean)) as never);
    if (ok) { setEdit(null); load(); }
  }

  async function removeItem(it: Item) {
    if (!window.confirm(`„${tx(it.name, 'de')}“ endgültig löschen? (Tipp: „Nicht anzeigen“ blendet es nur aus.)`)) return;
    if (await saver.run(() => supabase.from('menu_items').delete().eq('id', it.id) as never)) { setEdit(null); load(); }
  }

  async function move<T extends { id: string; position: number }>(table: 'menu_items' | 'menu_categories', list: T[], idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[idx], b = list[j];
    await saver.run(async () => {
      // Positionen tauschen (bei gleichen Werten neu durchnummerieren)
      const pa = a.position === b.position ? j : b.position, pb = a.position === b.position ? idx : a.position;
      const r1 = await supabase.from(table).update({ position: pa }).eq('id', a.id);
      if (r1.error) return r1;
      return supabase.from(table).update({ position: pb }).eq('id', b.id);
    });
    load();
  }

  async function saveCat() {
    if (!catEdit || !catEdit.name.de?.trim()) return;
    const ok = await saver.run(() => (catEdit.id
      ? supabase.from('menu_categories').update({ name: catEdit.name }).eq('id', catEdit.id)
      : supabase.from('menu_categories').insert({ restaurant_id: rid, name: catEdit.name, position: cats.length })) as never);
    if (ok) { setCatEdit(null); load(); }
  }
  async function removeCat(c: Category) {
    const n = items.filter((i) => i.category_id === c.id).length;
    if (!window.confirm(n ? `Kategorie „${tx(c.name, 'de')}“ mit ${n} Gerichten löschen?` : `Kategorie „${tx(c.name, 'de')}“ löschen?`)) return;
    if (await saver.run(() => supabase.from('menu_categories').delete().eq('id', c.id) as never)) { setCatEdit(null); load(); }
  }

  async function onPhoto(f: File | undefined) {
    if (!f || !edit) return;
    await saver.run(async () => { const url = await uploadImage(rid, 'items', f, 1000, true); setEdit({ ...edit, photo_url: url }); });
  }

  return (
    <div className="m-wrap">
      <div className="m-bar">
        <p className="s-hint">Gerichte, Preise, Fotos und Allergene. Änderungen sehen Gäste sofort.</p>
        <div>{saver.badge}<button className="s-btn" onClick={() => setCatEdit({ name: {} })}>＋ Kategorie</button></div>
      </div>

      {cats.map((c, ci) => {
        const list = items.filter((i) => i.category_id === c.id);
        return (
          <section key={c.id} className="m-cat">
            <header>
              <h3>{tx(c.name, 'de')}</h3>
              <div className="m-actions">
                <button onClick={() => move('menu_categories', cats, ci, -1)} aria-label="Nach oben">↑</button>
                <button onClick={() => move('menu_categories', cats, ci, 1)} aria-label="Nach unten">↓</button>
                <button onClick={() => setCatEdit({ id: c.id, name: c.name })}>Umbenennen</button>
                <button className="add" onClick={() => setEdit(blank(c.id, (list.at(-1)?.position ?? items.length) + 1))}>＋ Gericht</button>
              </div>
            </header>
            {list.map((i, ii) => (
              <div key={i.id} className={`m-row ${!i.active ? 'hidden' : ''}`}>
                {i.photo_url ? <img src={i.photo_url} alt="" /> : <span className="m-noimg">Foto</span>}
                <button className="m-row-main" onClick={() => setEdit(i)}>
                  <b>{tx(i.name, 'de')}</b>
                  <small>{eur(i.price_cents)} · {i.vat_rate} % · {i.allergens.join(', ') || 'keine Allergene'}{!i.active ? ' · ausgeblendet' : ''}{i.sold_out ? ' · ausverkauft' : ''}</small>
                </button>
                <div className="m-actions">
                  <button onClick={() => move('menu_items', list, ii, -1)} aria-label="Nach oben">↑</button>
                  <button onClick={() => move('menu_items', list, ii, 1)} aria-label="Nach unten">↓</button>
                </div>
              </div>
            ))}
            {!list.length && <p className="s-empty">Noch keine Gerichte.</p>}
          </section>
        );
      })}

      {catEdit && (
        <div className="m-modal-bg" onClick={() => setCatEdit(null)}>
          <div className="m-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{catEdit.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2>
            <I18nInput label="Name" value={catEdit.name} languages={languages} onChange={(name) => setCatEdit({ ...catEdit, name })} />
            <div className="m-foot">
              {catEdit.id && <button className="s-btn ghost danger" onClick={() => removeCat(cats.find((c) => c.id === catEdit.id)!)}>Löschen</button>}
              <span />
              <button className="s-btn" onClick={() => setCatEdit(null)}>Abbrechen</button>
              <button className="s-btn primary" onClick={saveCat}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="m-modal-bg" onClick={() => setEdit(null)}>
          <div className="m-modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>{edit.id ? 'Gericht bearbeiten' : 'Neues Gericht'}</h2>
            <div className="m-photo">
              {edit.photo_url ? <img src={edit.photo_url} alt="" /> : <span className="m-noimg big">Kein Foto</span>}
              <div>
                <label className="s-btn">Foto wählen<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onPhoto(e.target.files?.[0])} /></label>
                {edit.photo_url && <button className="s-btn ghost" onClick={() => setEdit({ ...edit, photo_url: null })}>Entfernen</button>}
                <small>Quadratisch zugeschnitten, max. 5 MB.</small>
              </div>
            </div>
            <I18nInput label="Name" value={edit.name} languages={languages} onChange={(name) => setEdit({ ...edit, name })} />
            <I18nInput label="Beschreibung" multiline value={edit.description} languages={languages} onChange={(description) => setEdit({ ...edit, description })} />
            <div className="m-grid3">
              <label className="m-field">Preis (€)<input inputMode="decimal" defaultValue={centsToEuro(edit.price_cents)} key={edit.id || 'new'}
                onChange={(e) => { const c = euroToCents(e.target.value); if (!Number.isNaN(c)) setEdit({ ...edit, price_cents: c }); }} /></label>
              <label className="m-field">MwSt.
                <select value={edit.vat_rate} onChange={(e) => setEdit({ ...edit, vat_rate: +e.target.value })}>
                  <option value={7}>7 % (Speisen)</option><option value={19}>19 % (Getränke)</option>
                </select>
              </label>
              <label className="m-field">Zubereitung
                <select value={edit.station} onChange={(e) => setEdit({ ...edit, station: e.target.value as 'kitchen' | 'bar' })}>
                  <option value="kitchen">Küche</option><option value="bar">Bar / Service</option>
                </select>
              </label>
            </div>
            <label className="m-field">Kategorie
              <select value={edit.category_id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                {cats.map((c) => <option key={c.id} value={c.id}>{tx(c.name, 'de')}</option>)}
              </select>
            </label>
            <fieldset className="m-allerg">
              <legend>Allergene</legend>
              {ALLERGENS.map(([k, n]) => (
                <label key={k} className={edit.allergens.includes(k) ? 'on' : ''}>
                  <input type="checkbox" checked={edit.allergens.includes(k)}
                    onChange={(e) => setEdit({ ...edit, allergens: e.target.checked ? [...edit.allergens, k].sort() : edit.allergens.filter((x) => x !== k) })} />
                  <b>{k}</b> {n}
                </label>
              ))}
            </fieldset>
            <div className="m-checks">
              <label><input type="checkbox" checked={edit.vegetarian} onChange={(e) => setEdit({ ...edit, vegetarian: e.target.checked })} /> Vegetarisch</label>
              <label><input type="checkbox" checked={edit.vegan} onChange={(e) => setEdit({ ...edit, vegan: e.target.checked, vegetarian: e.target.checked || edit.vegetarian })} /> Vegan</label>
              <label><input type="checkbox" checked={edit.sold_out} onChange={(e) => setEdit({ ...edit, sold_out: e.target.checked })} /> Heute ausverkauft</label>
              <label><input type="checkbox" checked={!edit.active} onChange={(e) => setEdit({ ...edit, active: !e.target.checked })} /> Nicht anzeigen</label>
            </div>
            <div className="m-foot">
              {edit.id && <button className="s-btn ghost danger" onClick={() => removeItem(edit as Item)}>Löschen</button>}
              <span>{saver.badge}</span>
              <button className="s-btn" onClick={() => setEdit(null)}>Abbrechen</button>
              <button className="s-btn primary" disabled={saver.saving} onClick={saveItem}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
