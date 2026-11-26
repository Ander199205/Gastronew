import type { I18nText, Theme } from './types';

export const eur = (cents: number) =>
  (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Texto en el idioma pedido, con alemán como respaldo. */
export const tx = (t: I18nText | null | undefined, lang: string) =>
  (t && (t[lang] || t.de || t.en || Object.values(t)[0])) || '';

/** Sustituye {clave} en una frase. */
export const fill = (s: string, args: Record<string, unknown> = {}) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (args[k] === undefined || args[k] === null ? '' : String(args[k])));

export const timeHM = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

/** Tipos de letra alojados en la propia app (nada de Google Fonts: DSGVO). */
const FONTS: Record<string, string> = {
  Fraunces: "'Fraunces Variable', Georgia, serif",
  'Instrument Sans': "'Instrument Sans Variable', system-ui, sans-serif",
  'Bricolage Grotesque': "'Bricolage Grotesque Variable', system-ui, sans-serif",
  System: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  Serif: 'Georgia, "Times New Roman", serif',
};
export const fontStack = (name?: string) => FONTS[name || ''] || FONTS['Instrument Sans'];

/** Variables CSS del tema de cada restaurante. */
export function themeVars(t: Theme): React.CSSProperties {
  const dark = t.mode === 'dark';
  return {
    '--c-primary': t.primary || '#B4532A',
    '--c-accent': t.accent || '#2F6B4F',
    '--c-bg': t.bg || (dark ? '#111' : '#FBF6EF'),
    '--c-surface': t.surface || (dark ? '#1b1b1b' : '#fff'),
    '--c-text': t.text || (dark ? '#f5f5f5' : '#2A211B'),
    '--c-muted': t.muted || (dark ? '#a3a3a3' : '#7A6A5D'),
    '--radius': t.radius || '16px',
    '--f-head': fontStack(t.font_heading || 'Fraunces'),
    '--f-body': fontStack(t.font_body || 'Instrument Sans'),
  } as React.CSSProperties;
}

export function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); o.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    o.stop(ctx.currentTime + 0.3);
  } catch { /* sin sonido */ }
}

/** Mensaje de error de Postgres a una clave corta (guest_open lanza 'invalid_table', etc.). */
export const errKey = (e: unknown) => {
  const m = (e as { message?: string })?.message || String(e);
  return m.split(':')[0].trim();
};
