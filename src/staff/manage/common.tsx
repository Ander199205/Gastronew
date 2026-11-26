import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { I18nText } from '../../lib/types';

export const LANGS = ['de', 'en', 'es', 'it', 'fr', 'tr'] as const;
export const LANG_NAME: Record<string, string> = { de: 'Deutsch', en: 'Englisch', es: 'Spanisch', it: 'Italienisch', fr: 'Französisch', tr: 'Türkisch' };

/** Allergene nach LMIV (Kennzeichnung mit Buchstaben, wie in Deutschland üblich). */
export const ALLERGENS: [string, string][] = [
  ['A', 'Glutenhaltiges Getreide'], ['B', 'Krebstiere'], ['C', 'Eier'], ['D', 'Fisch'], ['E', 'Erdnüsse'], ['F', 'Soja'],
  ['G', 'Milch/Laktose'], ['H', 'Schalenfrüchte'], ['I', 'Sellerie'], ['J', 'Senf'], ['K', 'Sesam'], ['L', 'Sulfite'],
  ['M', 'Lupinen'], ['N', 'Weichtiere'],
];

/** Textfeld in mehreren Sprachen. Deutsch ist Pflicht, der Rest optional (fällt auf Deutsch zurück). */
export function I18nInput({ label, value, onChange, multiline, languages = LANGS as unknown as string[] }: {
  label: string; value: I18nText; onChange: (v: I18nText) => void; multiline?: boolean; languages?: string[];
}) {
  const [lang, setLang] = useState('de');
  const set = (v: string) => {
    const n = { ...value, [lang]: v };
    if (!v.trim()) delete n[lang];
    onChange(n);
  };
  const Field = multiline ? 'textarea' : 'input';
  return (
    <div className="m-field">
      <div className="m-i18n-head">
        <span>{label}</span>
        <div className="m-langs">
          {languages.map((l) => (
            <button type="button" key={l} className={`${l === lang ? 'on' : ''} ${value[l] ? 'has' : ''}`} onClick={() => setLang(l)} title={LANG_NAME[l]}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <Field value={value[lang] || ''} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => set(e.target.value)}
        rows={multiline ? 2 : undefined} placeholder={lang === 'de' ? 'Pflichtfeld' : `Leer = deutscher Text (${value.de || '…'})`} />
    </div>
  );
}

/** Bild verkleinern (max. 1000 px, WebP) und in den Speicher des Restaurants laden. Gibt die öffentliche URL zurück. */
export async function uploadImage(rid: string, folder: string, file: File, max = 1000, square = false): Promise<string> {
  const bmp = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  c.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht verarbeitet werden'))), 'image/webp', 0.8));
  const path = `${rid}/${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from('restaurant-media').upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  return supabase.storage.from('restaurant-media').getPublicUrl(path).data.publicUrl;
}

export function useSaver() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  async function run(fn: () => Promise<{ error: { message: string } | null } | void>) {
    setState('saving'); setMsg('');
    try {
      const r = await fn();
      if (r && r.error) throw new Error(r.error.message);
      setState('saved'); window.setTimeout(() => setState('idle'), 1800);
      return true;
    } catch (e) {
      setState('error'); setMsg((e as Error).message);
      return false;
    }
  }
  const badge = state === 'saving' ? <span className="m-save">Speichert…</span>
    : state === 'saved' ? <span className="m-save ok">Gespeichert ✓</span>
      : state === 'error' ? <span className="m-save err">Fehler: {msg}</span> : null;
  return { run, badge, saving: state === 'saving' };
}

export const euroToCents = (s: string) => Math.round(parseFloat(s.replace(',', '.')) * 100);
export const centsToEuro = (c: number) => (c / 100).toFixed(2).replace('.', ',');
