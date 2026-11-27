// QA automático (web-qa-final): node qa/check.mjs [baseURL]
// Abre cada página a 375/768/1200/1440 px y comprueba scroll horizontal,
// errores JS, peticiones fallidas o de terceros, H1, títulos, alt y enlaces vacíos.
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:4173'
const PAGES = ['/', '/funktionen', '/reservierung', '/preise', '/kontakt', '/portal']
const WIDTHS = [375, 768, 1200, 1440]
const SHOTS = process.env.SHOTS || ''
const host = new URL(BASE).host
const problems = []
const titles = {}

const browser = await chromium.launch()
for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } })
  const errs = []
  page.on('pageerror', (e) => errs.push('JS: ' + e.message))
  page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()))
  page.on('requestfailed', (r) => errs.push('failed: ' + r.url()))
  page.on('request', (r) => { const u = new URL(r.url()); if (!['data:', 'blob:'].includes(u.protocol) && u.host !== host) errs.push('3rd-party: ' + r.url()) })
  for (const p of PAGES) {
    errs.length = 0
    await page.goto(BASE + p, { waitUntil: 'networkidle' })
    const r = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1: document.querySelectorAll('h1').length,
      title: document.title,
      desc: document.querySelector('meta[name=description]')?.content,
      canonical: document.querySelector('link[rel=canonical]')?.href,
      noAlt: [...document.images].filter((i) => !i.alt).length,
      emptyLinks: [...document.querySelectorAll('a')].filter((a) => ['', '#', 'mailto:', 'tel:'].includes(a.getAttribute('href') || '')).map((a) => a.textContent.trim()),
      badAnchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
      noLabel: [...document.querySelectorAll('input:not([type=hidden]):not(.hp),select,textarea')].filter((el) => !el.labels?.length && !el.closest('label') && !el.getAttribute('aria-label')).map((el) => el.name || el.id),
      legal: [...document.querySelectorAll('footer a')].some((a) => /impressum/i.test(a.textContent)) || location.pathname === '/portal',
      lang: document.documentElement.lang,
    }))
    const tag = `${p} @${w}px`
    if (r.overflow > 0) problems.push(`${tag}: scroll horizontal ${r.overflow}px`)
    if (r.h1 !== 1) problems.push(`${tag}: ${r.h1} H1`)
    if (r.noAlt) problems.push(`${tag}: ${r.noAlt} imágenes sin alt`)
    if (r.emptyLinks.length) problems.push(`${tag}: enlaces vacíos ${r.emptyLinks}`)
    if (r.badAnchors.length) problems.push(`${tag}: anclas rotas ${r.badAnchors}`)
    if (r.noLabel.length) problems.push(`${tag}: campos sin label ${r.noLabel}`)
    if (!r.legal) problems.push(`${tag}: sin enlace a Impressum`)
    if (r.lang !== 'de') problems.push(`${tag}: lang=${r.lang}`)
    errs.forEach((e) => problems.push(`${tag}: ${e}`))
    titles[p] = r
    if (SHOTS && (w === 375 || w === 1440)) await page.screenshot({ path: `${SHOTS}/${(p.slice(1) || 'home')}-${w}.png`, fullPage: true })
  }
  await page.close()
}
const t = Object.values(titles).map((x) => x.title)
if (new Set(t).size !== t.length) problems.push('Títulos repetidos')
await browser.close()
console.log(JSON.stringify(Object.fromEntries(Object.entries(titles).map(([k, v]) => [k, { title: v.title, canonical: v.canonical }])), null, 1))
console.log(problems.length ? 'PROBLEMAS:\n' + problems.join('\n') : 'OK: sin problemas en ' + PAGES.length * WIDTHS.length + ' comprobaciones')
process.exit(problems.length ? 1 : 0)
