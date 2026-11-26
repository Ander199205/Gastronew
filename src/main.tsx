import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/bricolage-grotesque';
import './styles/base.css';
import Home from './Home';

const GuestApp = lazy(() => import('./guest/GuestApp'));
const StaffApp = lazy(() => import('./staff/StaffApp'));
const DemoHome = lazy(() => import('./demo/DemoHome'));
const DEMO = import.meta.env.VITE_DEMO === '1';

if (DEMO) {
  // En la demo (dentro de un visor) no hay diálogos del navegador: se confirma siempre.
  window.confirm = () => true;
  window.alert = (m?: unknown) => console.warn(m);
}

createRoot(document.getElementById('root')!).render(
  DEMO ? (
    <StrictMode><Suspense fallback={<div className="boot">…</div>}><DemoHome /></Suspense></StrictMode>
  ) : (
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="boot">…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* carta del cliente: /r/casalucia/mesa/7?k=CLAVE (el QR de cada mesa) */}
          <Route path="/r/:slug" element={<GuestApp />} />
          <Route path="/r/:slug/mesa/:table" element={<GuestApp />} />
          <Route path="/r/:slug/tisch/:table" element={<GuestApp />} />
          {/* app del personal (PWA, en alemán) */}
          <Route path="/app/*" element={<StaffApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>
  ),
);
