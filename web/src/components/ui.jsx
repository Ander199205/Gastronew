import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { seo, site } from '../content/site.js'

// Linien-Icons in einem Stil (24px, 1.8 Strich)
const P = {
  phone: 'M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2',
  bag: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2',
  chef: 'M7 14v6h10v-6M7 14a4 4 0 1 1 1.5-7.7A4 4 0 0 1 15.5 6 4 4 0 1 1 17 14z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  grid: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  check: 'm5 12 5 5 9-10',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0M12 18v3',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 21a6 6 0 0 0-4-5.6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
}
export function Icon({ name, size = 22, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}

export function Logo({ tag = 'Gastro' }) {
  return (
    <span className="logo">
      <svg width="38" height="30" viewBox="0 0 38 30" aria-hidden="true">
        <defs>
          <linearGradient id="lgS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef2f7" /><stop offset="1" stopColor="#8d97a8" /></linearGradient>
          <linearGradient id="lgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fb0ff" /><stop offset="1" stopColor="#1d5fe0" /></linearGradient>
        </defs>
        <circle cx="11" cy="17" r="8" fill="none" stroke="url(#lgS)" strokeWidth="5" />
        <rect x="16.5" y="9" width="5" height="16" rx="2.5" fill="url(#lgS)" />
        <rect x="21" y="2" width="5" height="23" rx="2.5" fill="url(#lgB)" />
        <circle cx="29" cy="17" r="6" fill="none" stroke="url(#lgB)" strokeWidth="5" />
      </svg>
      <span className="logo-txt"><b>ab<span>Web</span></b><small>SOLUTIONS</small></span>
      {tag && <span className="logo-tag">{tag}</span>}
    </span>
  )
}

export function Heading({ eyebrow, title, highlight, lead, as: H = 'h2', center }) {
  return (
    <div className={'head' + (center ? ' center' : '')}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <H>{title} {highlight && <span className="hl">{highlight}</span>}</H>
      {lead && <p className="lead">{lead}</p>}
    </div>
  )
}

export function Btn({ to, href, children, variant = 'pri', arrow, ...rest }) {
  const cls = 'btn ' + variant
  const inner = <>{children}{arrow && <Icon name="arrow" size={18} />}</>
  if (href) return <a className={cls} href={href} {...rest}>{inner}</a>
  return <Link className={cls} to={to} {...rest}>{inner}</Link>
}

export function Checks({ items }) {
  return (
    <ul className="ck">
      {items.map((t) => <li key={t}><Icon name="check" size={18} className="ckic" /><span>{t}</span></li>)}
    </ul>
  )
}

// Setzt Titel, Beschreibung, Canonical und OG für jede Seite
export function useSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const s = seo[pathname] || seo['/']
    document.title = s.title
    const set = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val) }
    set('meta[name="description"]', 'content', s.description)
    set('meta[property="og:title"]', 'content', s.title)
    set('meta[property="og:description"]', 'content', s.description)
    set('link[rel="canonical"]', 'href', site.url + (pathname === '/' ? '/' : pathname))
    set('meta[property="og:url"]', 'content', site.url + pathname)
    window.scrollTo(0, 0)
  }, [pathname])
}

export const eur = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
