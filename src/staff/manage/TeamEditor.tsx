import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { staffAdmin } from '../../lib/staffAdmin';
import type { Staff } from '../../lib/types';
import { useSaver } from './common';

type Row = Staff & { email: string | null; active: boolean; user_id: string | null };
export const ROLE_DE: Record<Staff['role'], string> = { owner: 'Inhaber', manager: 'Leitung', waiter: 'Service', kitchen: 'Küche' };

/** Zugangsdaten anzeigen: einmalig, zum Weitergeben an die Person. */
export function Credentials({ email, password, onClose, title = 'Zugang erstellt' }: { email: string; password: string | null; onClose: () => void; title?: string }) {
  const url = `${window.location.origin}/app`;
  const text = password
    ? `abWeb Gastro Service-App\n${url}\nE-Mail: ${email}\nPasswort: ${password}\n(Beim ersten Anmelden ein eigenes Passwort wählen.)`
    : `abWeb Gastro Service-App\n${url}\nE-Mail: ${email}\n(Bestehendes Passwort verwenden.)`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="m-modal-bg" onClick={onClose}>
      <div className="m-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {password
          ? <p className="m-hint">Geben Sie diese Daten an die Person weiter. Das Passwort wird nur jetzt angezeigt. Beim ersten Anmelden wählt sie ein eigenes.</p>
          : <p className="m-hint">Diese E-Mail hat schon einen Zugang. Die Person meldet sich mit ihrem bisherigen Passwort an und sieht nun auch dieses Restaurant.</p>}
        <pre className="m-cred">{text}</pre>
        <div className="m-foot">
          <button className="s-btn" onClick={() => { navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {}); }}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
          <span />
          <button className="s-btn primary" onClick={onClose}>Fertig</button>
        </div>
      </div>
    </div>
  );
}

export default function TeamEditor({ rid, myRole, onSaved }: { rid: string; myRole: Staff['role']; onSaved: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [v, setV] = useState(0);
  const [form, setForm] = useState({ display_name: '', email: '', role: 'waiter' as Staff['role'] });
  const [cred, setCred] = useState<{ email: string; password: string | null; title?: string } | null>(null);
  const { run, badge, saving } = useSaver();
  const canOwner = myRole === 'owner';
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? null)); }, []);

  useEffect(() => {
    supabase.from('staff').select('id,restaurant_id,display_name,role,email,active,user_id').eq('restaurant_id', rid).order('display_name')
      .then(({ data }) => setRows((data || []) as Row[]));
  }, [rid, v]);
  const reload = () => { setV((x) => x + 1); onSaved(); };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    let res: { email?: string; password?: string | null } = {};
    const okk = await run(async () => { res = await staffAdmin('create_staff', { restaurant_id: rid, ...form }); });
    if (okk) {
      setCred({ email: res.email || form.email, password: res.password ?? null });
      setForm({ display_name: '', email: '', role: 'waiter' });
      reload();
    }
  }
  async function update(r: Row, patch: Partial<Row>) {
    if (await run(async () => supabase.from('staff').update(patch).eq('id', r.id))) reload();
  }
  async function reset(r: Row) {
    if (!window.confirm(`Neues Passwort für ${r.display_name} erstellen? Das alte gilt dann nicht mehr.`)) return;
    let res: { email?: string; password?: string | null } = {};
    if (await run(async () => { res = await staffAdmin('reset_password', { staff_id: r.id }); })) {
      setCred({ email: res.email || r.email || '', password: res.password ?? null, title: 'Neues Passwort' });
    }
  }
  const roles = (canOwner ? ['owner', 'manager', 'waiter', 'kitchen'] : ['manager', 'waiter', 'kitchen']) as Staff['role'][];

  return (
    <div className="m-wrap">
      <div className="m-bar"><div><h2 style={{ margin: 0 }}>Team</h2>{badge}</div></div>
      <p className="m-hint">Jede Person bekommt einen eigenen Zugang. Service sieht Tische und Bestellungen, Küche nur die Küche, Leitung und Inhaber auch die Verwaltung.</p>

      <form className="m-cat m-addstaff" onSubmit={add}>
        <label className="m-field">Name<input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} maxLength={40} required placeholder="z. B. Carmen" /></label>
        <label className="m-field">E-Mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="name@beispiel.de" /></label>
        <label className="m-field">Rolle
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Staff['role'] })}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_DE[r]}</option>)}
          </select>
        </label>
        <button className="s-btn primary" disabled={saving}>Zugang anlegen</button>
      </form>

      <div className="m-cat">
        {rows.map((r) => {
          const self = !!me && r.user_id === me;
          const locked = (r.role === 'owner' && !canOwner) || self;
          return (
            <div key={r.id} className={`m-row ${r.active ? '' : 'hidden'}`}>
              <span className="m-av">{r.display_name[0]?.toUpperCase()}</span>
              <div className="m-row-main"><b>{r.display_name}</b><small>{r.email || 'ohne E-Mail'}{self ? ' · Sie' : ''}{r.active ? '' : ' · deaktiviert'}</small></div>
              <select className="s-select" value={r.role} disabled={locked} onChange={(e) => update(r, { role: e.target.value as Staff['role'] })} aria-label="Rolle">
                {(locked ? [r.role] : roles).map((x) => <option key={x} value={x}>{ROLE_DE[x as Staff['role']]}</option>)}
              </select>
              {!locked && r.user_id && <button className="s-btn sm" onClick={() => reset(r)}>Passwort</button>}
              {!locked && <button className={`s-btn sm ${r.active ? 'danger' : ''}`} onClick={() => update(r, { active: !r.active })}>{r.active ? 'Sperren' : 'Aktivieren'}</button>}
            </div>
          );
        })}
        {!rows.length && <p className="m-hint">Noch niemand im Team.</p>}
      </div>
      {cred && <Credentials {...cred} onClose={() => setCred(null)} />}
    </div>
  );
}
