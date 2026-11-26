import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Staff } from '../lib/types';
import { useService } from './useService';
import { Kitchen, MenuToggles, Orders, QrCodes, Tables } from './views';
import Manage from './manage/Manage';
import '../styles/staff.css';

export default function StaffApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { document.title = 'abWeb Gastro · Service'; document.documentElement.lang = 'de'; }, []);

  if (session === undefined) return <div className="s-root s-center">Lädt…</div>;
  if (!session) return <Login />;
  return <Signed userId={session.user.id} email={session.user.email || ''} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setErr('E-Mail oder Passwort stimmt nicht.');
  }
  return (
    <div className="s-root s-center">
      <form className="s-login" onSubmit={submit}>
        <div className="ab-logo"><span>ab</span></div>
        <h1>Service-App</h1>
        <p>Für Service und Küche. Melden Sie sich mit Ihrem Zugang an.</p>
        <label>E-Mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Passwort<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        {err && <p className="s-err">{err}</p>}
        <button className="s-btn primary" disabled={busy}>{busy ? 'Anmelden…' : 'Anmelden'}</button>
        <small>abWeb Gastro · eine Plattform von abWeb solutions</small>
      </form>
    </div>
  );
}

function Signed({ userId, email }: { userId: string; email: string }) {
  const [me, setMe] = useState<Staff[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [rid, setRid] = useState<string | null>(() => localStorage.getItem('abg:rid'));
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [s, a] = await Promise.all([
        supabase.from('staff').select('id,restaurant_id,display_name,role').eq('user_id', userId).eq('active', true),
        supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
      ]);
      let rows = (s.data || []) as Staff[];
      setAdmin(!!a.data);
      const rs = await supabase.from('restaurants').select('id,name').order('name');
      const map = Object.fromEntries((rs.data || []).map((r) => [r.id, r.name]));
      setNames(map);
      // un admin de abWeb puede entrar a cualquier restaurante como "owner"
      if (a.data) {
        const extra = (rs.data || []).filter((r) => !rows.some((x) => x.restaurant_id === r.id))
          .map((r) => ({ id: '', restaurant_id: r.id, display_name: 'abWeb Admin', role: 'owner' as const }));
        rows = [...rows, ...extra];
      }
      setMe(rows);
      setRid((cur) => (cur && rows.some((x) => x.restaurant_id === cur) ? cur : rows[0]?.restaurant_id || null));
    })();
  }, [userId]);

  useEffect(() => { if (rid) localStorage.setItem('abg:rid', rid); }, [rid]);
  const svc = useService(rid);

  if (!me) return <div className="s-root s-center">Lädt…</div>;
  if (!me.length) {
    return (
      <div className="s-root s-center"><div className="s-login">
        <h1>Kein Restaurant</h1><p>{email} ist noch keinem Restaurant zugeordnet. Bitte wenden Sie sich an abWeb solutions.</p>
        <button className="s-btn" onClick={() => supabase.auth.signOut()}>Abmelden</button>
      </div></div>
    );
  }
  const mine = me.find((x) => x.restaurant_id === rid) || me[0];
  const role = mine.role;
  const isManager = role === 'owner' || role === 'manager';
  const kitchenOnly = role === 'kitchen';
  const newCount = svc.data.orders.filter((o) => o.status === 'new').length;
  const unread = svc.data.messages.filter((m) => m.sender === 'guest' && !m.read_by_staff).length;
  const bills = svc.data.visits.filter((v) => v.status === 'bill_requested').length;
  const kitchenCount = svc.data.orders.filter((o) => o.status === 'accepted' && svc.data.items.some((i) => i.order_id === o.id && i.station === 'kitchen')).length;

  return (
    <div className="s-root">
      <header className="s-top">
        <div className="s-brand"><span className="s-mark">ab</span>
          <div><b>{svc.data.restaurant?.name || names[mine.restaurant_id] || '…'}</b><small>{mine.display_name} · {ROLE[role]}</small></div>
        </div>
        <div className="s-top-right">
          <span className={`s-live ${svc.live ? 'on' : ''}`} title={svc.live ? 'Live verbunden' : 'Verbinde…'}>{svc.live ? 'Live' : 'Offline'}</span>
          {(me.length > 1 || admin) && (
            <select className="s-select" value={rid || ''} onChange={(e) => setRid(e.target.value)} aria-label="Restaurant">
              {me.map((x) => <option key={x.restaurant_id} value={x.restaurant_id}>{names[x.restaurant_id] || x.restaurant_id}</option>)}
            </select>
          )}
          <button className="s-btn sm" onClick={() => supabase.auth.signOut()}>Abmelden</button>
        </div>
      </header>
      <nav className="s-tabs">
        {!kitchenOnly && <NavLink to="/app/tische">Tische{(unread + bills) > 0 && <i>{unread + bills}</i>}</NavLink>}
        {!kitchenOnly && <NavLink to="/app/bestellungen">Bestellungen{newCount > 0 && <i>{newCount}</i>}</NavLink>}
        <NavLink to="/app/kueche">Küche{kitchenCount > 0 && <i>{kitchenCount}</i>}</NavLink>
        <NavLink to="/app/karte">Karte</NavLink>
        {isManager && <NavLink to="/app/qr">QR-Codes</NavLink>}
        {isManager && <NavLink to="/app/verwaltung">Verwaltung</NavLink>}
      </nav>
      <main className="s-main">
        <Routes>
          <Route index element={<Navigate to={kitchenOnly ? '/app/kueche' : '/app/tische'} replace />} />
          <Route path="tische" element={<Tables svc={svc} />} />
          <Route path="tische/:tableId" element={<Tables svc={svc} />} />
          <Route path="bestellungen" element={<Orders svc={svc} />} />
          <Route path="kueche" element={<Kitchen svc={svc} />} />
          <Route path="karte" element={<MenuToggles svc={svc} />} />
          <Route path="qr" element={isManager ? <QrCodes svc={svc} /> : <Navigate to="/app" replace />} />
          <Route path="verwaltung/*" element={isManager && rid ? <Manage rid={rid} onChanged={svc.reload} /> : <Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}

const ROLE: Record<Staff['role'], string> = { owner: 'Inhaber', manager: 'Leitung', waiter: 'Service', kitchen: 'Küche' };
