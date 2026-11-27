import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { company, site } from '../content/site.js'
import { Btn, Icon, Logo, useSeo } from './ui.jsx'

function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <header className="top">
      <div className="wrap top-in">
        <Link to="/" aria-label="abWeb Gastro Startseite"><Logo /></Link>
        <nav className="menu" aria-label="Hauptmenü">
          {site.nav.slice(1).map((n) => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
        </nav>
        <a className="portal-link" href={company.portalLogin} rel="noopener" title="Login für Kunden"><Icon name="lock" size={16} /><span>Login</span></a>
        <Btn to={site.cta.to} className="btn pri navcta">{site.cta.label}</Btn>
        <button className="burger" type="button" aria-label={open ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={open} aria-controls="mnav" onClick={() => setOpen(!open)}>
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </div>
      <div id="mnav" className="mnav" hidden={!open}>
        <nav aria-label="Mobiles Menü">
          {site.nav.map((n) => <NavLink key={n.to} to={n.to} end>{n.label}</NavLink>)}
          <NavLink to="/kontakt">Kontakt</NavLink>
        </nav>
        <Btn to={site.cta.to} arrow>{site.cta.label}</Btn>
        <p className="mut small">{company.email} · {company.phone}</p>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="cols">
          <div>
            <Logo />
            <p className="mut">Digitale Speisekarte, Bestellung vom Tisch und Reservierung 24/7. Ein Bereich von <a href={company.mainSite}>{company.brand}</a>, persönlich betreut aus {company.city}.</p>
          </div>
          <div>
            <h4>Seiten</h4>
            <ul>
              {site.nav.map((n) => <li key={n.to}><Link to={n.to}>{n.label}</Link></li>)}
              <li><Link to="/kontakt">Kontakt</Link></li>
            </ul>
          </div>
          <div>
            <h4>Rechtliches</h4>
            <ul>
              <li><a href={company.impressum}>Impressum</a></li>
              <li><a href={company.datenschutz}>Datenschutz</a></li>
            </ul>
          </div>
          <div>
            <h4>Kontakt</h4>
            <ul>
              <li><a href={'mailto:' + company.email}>{company.email}</a></li>
              <li><a href={'tel:' + company.phoneHref}>{company.phone}</a></li>
              <li><a href={company.whatsapp} rel="noopener">WhatsApp</a></li>
              <li>{company.street}, {company.zip} {company.city}</li>
            </ul>
          </div>
        </div>
        <div className="copy">
          <span>© {new Date().getFullYear()} {company.brand} · {company.owner} · {company.city}</span>
          <span>{company.taxNote}</span>
        </div>
      </div>
    </footer>
  )
}

export default function Layout() {
  useSeo()
  return (
    <>
      <a className="skip" href="#main">Zum Inhalt springen</a>
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
    </>
  )
}
