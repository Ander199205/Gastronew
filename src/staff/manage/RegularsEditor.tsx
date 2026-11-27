import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSaver } from './common';

interface P { id: string; email: string; name: string | null; visits: number; last_visit_at: string; consent_at: string; confirmed_at: string | null; note: string | null; language: string | null }

/** Stammgäste: nur Gäste, die ihre E-Mail selbst hinterlassen, eingewilligt und per Link bestätigt haben (Double-Opt-in). Unbestätigte Adressen löschen wir nach 48 Stunden. Alle anderen Daten werden nach dem Bezahlen gelöscht. */
export default function RegularsEditor({ rid }: { rid: string }) {
  const [rows, setRows] = useState<P[] | null>(null);
  const [v, setV] = useState(0);
  const [q, setQ] = useState('');
  const { run, badge } = useSaver();
  useEffect(() => {
    supabase.from('guest_profiles').select('id,email,name,visits,last_visit_at,consent_at,confirmed_at,note,language').eq('restaurant_id', rid).order('last_visit_at', { ascending: false })
      .then(({ data }) => setRows((data || []) as P[]));
  }, [rid, v]);
  async function remove(p: P) {
    if (!window.confirm(`${p.name || p.email} und alle gespeicherten Daten endgültig löschen?`)) return;
    if (await run(async () => supabase.from('guest_profiles').delete().eq('id', p.id))) setV((x) => x + 1);
  }
  const list = (rows || []).filter((p) => !q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase()));
  const day = (s: string) => new Date(s).toLocaleDateString('de-DE');
  return (
    <div className="m-wrap">
      <div className="m-bar"><div><h2 style={{ margin: 0 }}>Stammgäste</h2>{badge}</div>
        <div><input className="s-select" style={{ maxWidth: 220 }} placeholder="Suchen" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <p className="m-hint">Hier stehen nur Gäste, die ihre E-Mail selbst hinterlassen, eingewilligt und per Link bestätigt haben (Double-Opt-in). Unbestätigte Adressen löschen wir nach 48 Stunden. Von allen anderen löschen wir Name und Chat nach dem Bezahlen. Möchte jemand gelöscht werden, hier auf „Löschen“ tippen.</p>
      <div className="m-cat">
        {list.map((p) => (
          <div key={p.id} className="m-row">
            <span className="m-av">{(p.name || p.email)[0]?.toUpperCase()}</span>
            <div className="m-row-main"><b>{p.name || '–'}</b><small>{p.email} · {p.visits} Besuche · zuletzt {day(p.last_visit_at)} · {p.confirmed_at ? `bestätigt ${day(p.confirmed_at)}` : 'E-Mail noch nicht bestätigt'}{p.note ? ` · ${p.note}` : ''}</small></div>
            <button className="s-btn sm danger" onClick={() => remove(p)}>Löschen</button>
          </div>
        ))}
        {rows && !list.length && <p className="m-hint">Noch keine Stammgäste.</p>}
      </div>
    </div>
  );
}
