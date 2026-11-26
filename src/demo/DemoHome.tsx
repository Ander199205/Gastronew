import { lazy, Suspense, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { resetDemo } from './fakeSupabase';
import './demo.css';

const GuestApp = lazy(() => import('../guest/GuestApp'));
const StaffApp = lazy(() => import('../staff/StaffApp'));

const ROLES = [
  { k: 'carmen', label: 'Camarera (Carmen)', path: '/app/tische' },
  { k: 'kueche', label: 'Cocina', path: '/app/kueche' },
  { k: 'lucia', label: 'Dueña (Lucía): panel', path: '/app/verwaltung' },
];

/** Demo: el móvil del cliente y la app del personal, lado a lado y conectados (mismo Supabase simulado). */
export default function DemoHome() {
  const [role, setRole] = useState(ROLES[0]);
  const [v, setV] = useState(0);
  const [tab, setTab] = useState<'guest' | 'staff'>('guest');
  function reset() {
    resetDemo();
    try { Object.keys(localStorage).filter((k) => k.startsWith('abg:')).forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
    setV((x) => x + 1);
  }
  return (
    <div className="d-root">
      <header className="d-head">
        <div className="d-brand"><span className="ab">ab</span><div><b>abWeb Gastro</b><small>Demo con datos de prueba · Casa Lucía, mesa 7</small></div></div>
        <button className="d-reset" onClick={reset}>Reiniciar demo</button>
      </header>
      <p className="d-intro">
        Es la app real con datos de prueba que solo viven en esta página. Pide desde el móvil del cliente y mira cómo llega a la camarera. Cambia a <b>Cocina</b> para marcar el plato como listo, o a <b>Dueña</b> para editar la carta y los colores.
      </p>
      <div className="d-tabs" role="tablist">
        <button className={tab === 'guest' ? 'on' : ''} onClick={() => setTab('guest')}>Cliente</button>
        <button className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>Personal</button>
      </div>
      <main className="d-stage">
        <section className={`d-col phone ${tab === 'guest' ? 'show' : ''}`}>
          <h2>Cliente <small>ha escaneado el QR de la mesa 7</small></h2>
          <div className="d-frame phone"><div className="d-screen">
            <MemoryRouter key={`g${v}`} initialEntries={['/r/casalucia/mesa/7?k=key7']}>
              <Suspense fallback={null}><Routes><Route path="/r/:slug/mesa/:table" element={<GuestApp />} /></Routes></Suspense>
            </MemoryRouter>
          </div></div>
        </section>
        <section className={`d-col ${tab === 'staff' ? 'show' : ''}`}>
          <h2>Personal <small>
            {ROLES.map((r) => <button key={r.k} className={r.k === role.k ? 'on' : ''} onClick={() => setRole(r)}>{r.label}</button>)}
          </small></h2>
          <div className="d-frame tablet"><div className="d-screen">
            <MemoryRouter key={`s${v}${role.k}`} initialEntries={[`${role.path}?as=${role.k}`]}>
              <Suspense fallback={null}><Routes><Route path="/app/*" element={<StaffApp />} /></Routes></Suspense>
            </MemoryRouter>
          </div></div>
        </section>
      </main>
    </div>
  );
}
