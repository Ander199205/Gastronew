import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Restaurant, Theme } from '../../lib/types';
import { themeVars } from '../../lib/util';
import { I18nInput, LANGS, LANG_NAME, uploadImage, useSaver } from './common';

const FONTS = ['Fraunces', 'Instrument Sans', 'Bricolage Grotesque', 'Serif', 'System'];
const PRESETS: { name: string; t: Theme }[] = [
  { name: 'Mediterran', t: { primary: '#B4532A', accent: '#2F6B4F', bg: '#FBF6EF', surface: '#FFFFFF', text: '#2A211B', muted: '#7A6A5D', font_heading: 'Fraunces', font_body: 'Instrument Sans', radius: '16px', mode: 'light' } },
  { name: 'Klassisch', t: { primary: '#7A1F2B', accent: '#B08D57', bg: '#F7F3EC', surface: '#FFFFFF', text: '#1E1B18', muted: '#6E645A', font_heading: 'Serif', font_body: 'Instrument Sans', radius: '6px', mode: 'light' } },
  { name: 'Modern dunkel', t: { primary: '#F5C518', accent: '#6C7BFF', bg: '#111216', surface: '#1B1D24', text: '#F3F4F6', muted: '#A1A5B0', font_heading: 'Bricolage Grotesque', font_body: 'Instrument Sans', radius: '20px', mode: 'dark' } },
  { name: 'Frisch', t: { primary: '#0E9F6E', accent: '#F97316', bg: '#F4FBF7', surface: '#FFFFFF', text: '#0F2A1E', muted: '#5B7569', font_heading: 'Bricolage Grotesque', font_body: 'Instrument Sans', radius: '14px', mode: 'light' } },
];
const COLORS: [keyof Theme, string][] = [['primary', 'Hauptfarbe (Buttons)'], ['accent', 'Akzent'], ['bg', 'Hintergrund'], ['surface', 'Karten'], ['text', 'Text'], ['muted', 'Text gedämpft']];

export default function BrandEditor({ rid, onSaved }: { rid: string; onSaved: () => void }) {
  const [r, setR] = useState<Restaurant | null>(null);
  const saver = useSaver();
  useEffect(() => {
    supabase.from('restaurants').select('*').eq('id', rid).single().then(({ data }) => setR(data as Restaurant));
  }, [rid]);
  if (!r) return <p className="s-empty">Lädt…</p>;
  const t = r.theme || {};
  const setT = (p: Partial<Theme>) => setR({ ...r, theme: { ...t, ...p } });

  async function save() {
    if (!r) return;
    if (!r.name.trim()) { window.alert('Bitte einen Namen eingeben.'); return; }
    const langs = r.languages.includes(r.default_language) ? r.languages : [r.default_language, ...r.languages];
    const ok = await saver.run(() => supabase.from('restaurants').update({
      name: r.name.trim(), tagline: r.tagline, address: r.address, city: r.city, imprint: r.imprint,
      languages: langs, default_language: r.default_language, theme: r.theme,
    }).eq('id', rid) as never);
    if (ok) onSaved();
  }
  async function onLogo(f?: File) {
    if (!f) return;
    await saver.run(async () => setT({ logo_url: await uploadImage(rid, 'brand', f, 400) }));
  }

  return (
    <div className="m-brand">
      <div className="m-brand-form">
        <h3>Restaurant</h3>
        <label className="m-field">Name<input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></label>
        <I18nInput label="Untertitel (z. B. Küche · Stadt)" value={r.tagline} languages={r.languages} onChange={(tagline) => setR({ ...r, tagline })} />
        <label className="m-field">Adresse<input value={r.address || ''} onChange={(e) => setR({ ...r, address: e.target.value })} /></label>
        <label className="m-field">Impressum / Datenschutz (kurz, steht unten auf der Karte)
          <textarea rows={2} value={r.imprint || ''} onChange={(e) => setR({ ...r, imprint: e.target.value })} placeholder="Firmenname, Inhaber, Anschrift, Link zur Datenschutzerklärung" />
        </label>
        <fieldset className="m-checks">
          <legend>Sprachen der Gästekarte</legend>
          {LANGS.map((l) => (
            <label key={l}><input type="checkbox" checked={r.languages.includes(l)} disabled={l === r.default_language}
              onChange={(e) => setR({ ...r, languages: e.target.checked ? LANGS.filter((x) => x === l || r.languages.includes(x)) : r.languages.filter((x) => x !== l) })} /> {LANG_NAME[l]}</label>
          ))}
        </fieldset>

        <h3>Design</h3>
        <div className="m-presets">{PRESETS.map((p) => (
          <button key={p.name} onClick={() => setT(p.t)} style={{ background: p.t.bg, color: p.t.text }}>
            <i style={{ background: p.t.primary }} /><i style={{ background: p.t.accent }} />{p.name}
          </button>
        ))}</div>
        <div className="m-colors">
          {COLORS.map(([k, label]) => (
            <label key={k}><input type="color" value={(t[k] as string) || '#000000'} onChange={(e) => setT({ [k]: e.target.value })} /> {label}</label>
          ))}
        </div>
        <div className="m-grid3">
          <label className="m-field">Schrift Titel<select value={t.font_heading || 'Fraunces'} onChange={(e) => setT({ font_heading: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className="m-field">Schrift Text<select value={t.font_body || 'Instrument Sans'} onChange={(e) => setT({ font_body: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className="m-field">Ecken<select value={t.radius || '16px'} onChange={(e) => setT({ radius: e.target.value })}>
            <option value="4px">eckig</option><option value="10px">leicht rund</option><option value="16px">rund</option><option value="24px">sehr rund</option>
          </select></label>
        </div>
        <div className="m-photo">
          {t.logo_url ? <img src={t.logo_url} alt="" className="contain" /> : <span className="m-noimg">Logo</span>}
          <div>
            <label className="s-btn">Logo hochladen<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onLogo(e.target.files?.[0])} /></label>
            {t.logo_url && <button className="s-btn ghost" onClick={() => setT({ logo_url: undefined })}>Entfernen</button>}
            <label className="m-field">Oder Buchstabe<input maxLength={2} value={t.logo_letter || ''} onChange={(e) => setT({ logo_letter: e.target.value })} /></label>
          </div>
        </div>
        <div className="m-foot sticky"><span>{saver.badge}</span><button className="s-btn primary" disabled={saver.saving} onClick={save}>Speichern</button></div>
      </div>

      <div className="m-preview" style={themeVars(t)} aria-label="Vorschau">
        <div className="pv-head">
          {t.logo_url ? <img src={t.logo_url} alt="" /> : <span className="pv-mark">{t.logo_letter || r.name[0]}</span>}
          <div><b>{r.name}</b><small>{r.tagline.de}</small></div>
        </div>
        <div className="pv-body">
          <h4>Vorspeisen</h4>
          <div className="pv-card"><div className="pv-ph" /><div><b>Bruschetta</b><p>Geröstetes Brot, Tomaten, Kräuter</p><div className="pv-foot"><span>7,90 €</span><i>+</i></div></div></div>
          <div className="pv-card"><div className="pv-ph" /><div><b>Hummus</b><p>Kichererbsen, Tahini, Zitrone</p><div className="pv-foot"><span>8,50 €</span><i>+</i></div></div></div>
          <button className="pv-btn">Bestellung senden</button>
        </div>
      </div>
    </div>
  );
}
