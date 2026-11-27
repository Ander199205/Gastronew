import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter-tight/700.css'
import './styles.css'
import Layout from './components/Layout.jsx'
import { Funktionen, Home, Kontakt, NotFound, Preise, Reservierung } from './pages/pages.jsx'
import Portal from './portal/Portal.jsx'

// Vorschau (Artifact) nutzt Hash-URLs, die echte Website saubere URLs
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router basename={import.meta.env.VITE_HASH_ROUTER ? undefined : import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/funktionen" element={<Funktionen />} />
          <Route path="/reservierung" element={<Reservierung />} />
          <Route path="/preise" element={<Preise />} />
          <Route path="/kontakt" element={<Kontakt />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/portal" element={<Portal />} />
      </Routes>
    </Router>
  </React.StrictMode>,
)
