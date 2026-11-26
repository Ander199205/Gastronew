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

createRoot(document.getElementById('root')!).render(
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
  </StrictMode>,
);
