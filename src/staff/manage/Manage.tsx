import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import BrandEditor from './BrandEditor';
import MenuEditor from './MenuEditor';
import { NearbyEditor, TablesEditor } from './TablesNearbyEditor';
import '../../styles/manage.css';

/** Verwaltung für Inhaber und Leitung: Speisekarte, Design, Tische, Tipps. */
export default function Manage({ rid, onChanged }: { rid: string; onChanged: () => void }) {
  const [languages, setLanguages] = useState<string[]>(['de']);
  const [v, setV] = useState(0);
  useEffect(() => {
    supabase.from('restaurants').select('languages').eq('id', rid).single().then(({ data }) => data && setLanguages(data.languages));
  }, [rid, v]);
  const saved = () => { setV((x) => x + 1); onChanged(); };
  return (
    <div>
      <nav className="m-subnav">
        <NavLink to="/app/verwaltung/karte">Speisekarte</NavLink>
        <NavLink to="/app/verwaltung/design">Restaurant &amp; Design</NavLink>
        <NavLink to="/app/verwaltung/tische">Tische</NavLink>
        <NavLink to="/app/verwaltung/tipps">Tipps in der Nähe</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to="karte" replace />} />
        <Route path="karte" element={<MenuEditor key={rid} rid={rid} languages={languages} />} />
        <Route path="design" element={<BrandEditor key={rid} rid={rid} onSaved={saved} />} />
        <Route path="tische" element={<TablesEditor key={rid} rid={rid} onSaved={saved} />} />
        <Route path="tipps" element={<NearbyEditor key={rid} rid={rid} languages={languages} />} />
      </Routes>
    </div>
  );
}
