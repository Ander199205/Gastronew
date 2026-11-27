import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GUEST_I18N, type Lang } from '../i18n/guest';
import { fill } from '../lib/util';
import '../styles/guest.css';

/** Enlace del correo de doble opt-in: /r/<slug>/bestaetigen?t=<token> */
export default function ConfirmPage() {
  const { slug = '' } = useParams();
  const [sp] = useSearchParams();
  const [res, setRes] = useState<{ restaurant: string; name: string | null; language: string } | null | undefined>(undefined);
  useEffect(() => {
    const t = sp.get('t');
    if (!t || !/^[0-9a-f-]{36}$/i.test(t)) { setRes(null); return; }
    supabase.rpc('guest_confirm', { p_token: t }).then(({ data, error }) => setRes(error ? null : (data as typeof res) ?? null));
  }, [sp]);
  const nav = (navigator.language || 'de').slice(0, 2) as Lang;
  const lang = ((res?.language as Lang) || nav) in GUEST_I18N ? ((res?.language as Lang) || nav) : 'de';
  const g = (k: string, a?: Record<string, unknown>) => fill(GUEST_I18N[lang as Lang][k] ?? GUEST_I18N.de[k], a);
  return (
    <div className="g-root"><main className="g-col g-pad g-thanks">
      {res === undefined ? <p className="g-muted">{g('confirming')}</p>
        : res ? <h2 className="g-h">{g('confirmOk', { n: res.name ? `, ${res.name}` : '', r: res.restaurant })}</h2>
          : <h2 className="g-h">{g('confirmBad')}</h2>}
      <Link className="g-btn ghost" to={`/r/${slug}`}>{g('toMenu')}</Link>
    </main></div>
  );
}
